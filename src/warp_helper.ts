// @ts-ignore
import { SkipBundleClient } from '@skip-mev/skipjs';
import { Coins, CreateTxOptions, MnemonicKey, MsgExecuteContract, Wallet } from '@terra-money/terra.js';
import axios from 'axios';
import { warp_controller, WarpSdk } from '@terra-money/warp-sdk';
// @ts-ignore
import { getValueByKeyInAttributes, MyRedisClientType } from './util';
import { TMEvent, TMEventAttribute } from 'schema';
// @ts-ignore
import { EVENT_ATTRIBUTE_KEY_ACTION, EVENT_ATTRIBUTE_KEY_JOB_CONDITION, EVENT_ATTRIBUTE_KEY_JOB_ID, EVENT_ATTRIBUTE_VALUE_CREATE_JOB, EVENT_ATTRIBUTE_VALUE_DELETE_JOB, EVENT_ATTRIBUTE_VALUE_EVICT_JOB, EVENT_ATTRIBUTE_VALUE_EXECUTE_JOB, EVENT_ATTRIBUTE_VALUE_UPDATE_JOB } from 'constant';

export const saveJob = async (job: warp_controller.Job, redisClient: MyRedisClientType) => {
    // limit to 0.001 luna
    let reward = Number(job.reward.substring(0, job.reward.length - 3));
    if (reward === 0) {
        console.log('reward too low, less than 0.001 luna, ignore the job, will add back if creator updates reward later');
        return;
    }
    redisClient.sAdd('ids', job.id);
    redisClient.zAdd('ids_sort_by_reward', { score: reward, value: job.id });
    redisClient.hSet('conditions', job.id, JSON.stringify(job.condition));
    redisClient.hSet('messages', job.id, JSON.stringify(job.msgs));
    if (job.vars && job.vars.length !== 0) {
        redisClient.hSet('vars', job.id, JSON.stringify(job.vars.map((job_var) => JSON.stringify(job_var))));
    } else {
        redisClient.hSet('vars', job.id, '[]');
    }
};

export function executeMsg<T extends {}>(sender: string, contract: string, msg: T, coins?: Coins.Input) {
    return new MsgExecuteContract(sender, contract, msg, coins);
}

export const batchExecuteJob = async () => { }

export const executeJob = async (
    jobId: string,
    wallet: Wallet,
    // @ts-ignore
    mnemonicKey: MnemonicKey,
    warpSdk: WarpSdk,
) => {
    // using sdk
    // warpSdk.executeJob(wallet.key.accAddress, jobId)

    // manually
    const msg = executeMsg<Extract<warp_controller.ExecuteMsg, { execute_job: warp_controller.ExecuteJobMsg }>>(
        wallet.key.accAddress,
        warpSdk.contractAddress,
        {
            execute_job: { id: jobId },
        }
    );

    const txOptions: CreateTxOptions = {
        msgs: [msg],
    };

    try {
        const tx = await wallet.createAndSignTx(txOptions);
        // without skip
        return await wallet.lcd.tx.broadcast(tx);

        // with skip
        // const txString = Buffer.from(tx.toBytes()).toString('base64');
        // const DESIRED_HEIGHT_FOR_BUNDLE = 0;
        // const skipBundleClient = new SkipBundleClient('http://pisco-1-api.skip.money');
        // const bundle = await skipBundleClient.signBundle([txString], mnemonicKey.privateKey);
        // return await skipBundleClient.sendBundle(bundle, DESIRED_HEIGHT_FOR_BUNDLE, true);
    } catch (err: any) {
        if (axios.isAxiosError(err)) {
            return err.response?.data;
        }
        return `unknown error: ${err}`
    }
};

export const findExecutableJobs = async (
    redisClient: MyRedisClientType,
    wallet: Wallet,
    mnemonicKey: MnemonicKey,
    warpSdk: WarpSdk
) => {
    let counter = 0;
    while (true) {
        console.log(`pending jobs count ${await redisClient.sCard('ids')}`);

        const allJobIds: string[] = await redisClient.sMembers('ids');
        for (let i = allJobIds.length - 1; i >= 0; i--) {
            const jobId = allJobIds[i];

            const condition_s = await redisClient.hGet('conditions', jobId!);
            const jobCondition = JSON.parse(condition_s!);

            const var_s = await redisClient.hGet('vars', jobId!);
            const job_variables = JSON.parse(var_s!).map((job_var: string) => JSON.parse(job_var));

            let isActive = false;
            try {
                isActive = await warpSdk.condition.resolveCond(jobCondition, job_variables);
            } catch (e) {
                console.log(`Error processing condition of job ${jobId}`, e);
                console.log(
                    'For jobs with invalid condition, we still try to execute them because we get reward from failed jobs'
                );
                isActive = true;
            }
            if (isActive) {
                console.log(`Find active job ${jobId} from redis, try executing!`);
                console.log(await executeJob(jobId!, wallet, mnemonicKey, warpSdk));
                await redisClient.sRem('ids', jobId!);
            } else {
                // console.log("inactive")
            }
        }

        console.log(`loop ${counter}, sleep 1s`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        counter++;
    }
};

export const saveAllJobs = async (redisClient: MyRedisClientType, warpSdk: WarpSdk) => {
    let startAfter: warp_controller.JobIndex | null = null;
    const limit = 50;
    while (true) {
        try {
            const jobs: warp_controller.Job[] = await warpSdk.jobs({ limit, startAfter, job_status: 'Pending' });
            // we have exhausted all pending jobs
            if (jobs.length === 0) {
                break;
            }

            jobs.forEach((job) => {
                saveJob(job, redisClient);
            });

            const lastJobInPage = jobs[jobs.length - 1];
            console.log(`LAST JOB IN PAGE: ${lastJobInPage?.id}`);
            startAfter = { _0: lastJobInPage?.reward!, _1: lastJobInPage?.id! };
        } catch (e) {
            console.log(e);
            throw new Error('unknown error when saving pending jobs to redis');
        }
    }
};

export const handleJobCreation = async (
    jobId: string,
    // @ts-ignore
    attributes: TMEventAttribute[],
    redisClient: MyRedisClientType,
    mnemonicKey: MnemonicKey,
    wallet: Wallet,
    warpSdk: WarpSdk
) => {
    const exist = await redisClient.sIsMember('ids', jobId);
    if (exist) {
        console.log('job already in redis');
    } else {
        // const conditionStr = getValueByKeyInAttributes(attributes, EVENT_ATTRIBUTE_KEY_JOB_CONDITION)
        // const condition: warp_controller.Condition = JSON.parse(conditionStr)
        // var is not logged, i have to get it from chain, so only get condition from log is useless
        // const varStr = getValueByKeyInAttributes(attributes, )

        // console.log('sleep half block in case rpc has not synced to latest state yet');
        // await new Promise((resolve) => setTimeout(resolve, 1000));

        warpSdk.job(jobId).then((job: warp_controller.Job) => {
            warpSdk.condition.resolveCond(job.condition, job.vars).then(async (isActive: boolean) => {
                if (isActive) {
                    console.log('executing now');
                    // sleep half block, setten rpc reports job not found
                    // await new Promise((resolve) => setTimeout(resolve, 10000));
                    console.log(await executeJob(jobId, wallet, mnemonicKey, warpSdk));
                    console.log('done executing');
                } else {
                    console.log('not executable, save to redis');
                    saveJob(job, redisClient);
                }
            }).catch((err: Error) => {
                throw err
            })
        }).catch(err => {
            console.log('error getting job, probably due to rpc not updated to latest state', err);
            throw err
        })
    }

}

export const handleJobExecution = async () => {

}

export const handleJobUpdate = async () => {

}

export const handleJobDeletion = async () => {

}

export const handleJobEviction = async () => {

}

export const processEvent = async (
    event: TMEvent,
    redisClient: MyRedisClientType,
    mnemonicKey: MnemonicKey,
    wallet: Wallet,
    warpSdk: WarpSdk
) => {
    let jobId = ''
    let jobAction = ''
    const attributes = event.attributes
    for (const attribute of attributes) {
        if (attribute.key === EVENT_ATTRIBUTE_KEY_JOB_ID) {
            jobId = attribute.value
        } else if (attribute.key === EVENT_ATTRIBUTE_KEY_ACTION) {
            jobAction = attribute.value
        }
    }
    if (jobId === '' || jobAction === '') {
        throw new Error(`job id not found in tx, please inspect event manually: ${event}`)
    }
    console.log(`jobId: ${jobId}, jobAction: ${jobAction}`);

    switch (jobAction) {
        case EVENT_ATTRIBUTE_VALUE_CREATE_JOB:
            handleJobCreation(jobId, attributes, redisClient, mnemonicKey, wallet, warpSdk)
            break;
        case EVENT_ATTRIBUTE_VALUE_UPDATE_JOB:
            handleJobUpdate()
            break;
        case EVENT_ATTRIBUTE_VALUE_EXECUTE_JOB:
            handleJobExecution()
            break;
        case EVENT_ATTRIBUTE_VALUE_EVICT_JOB:
            handleJobEviction()
            break;
        case EVENT_ATTRIBUTE_VALUE_DELETE_JOB:
            handleJobDeletion()
            break;
        default:
            throw new Error(`unknown jobAction: ${jobAction}`)
    }
}
