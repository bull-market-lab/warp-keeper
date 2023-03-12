// @ts-nocheck
import { SkipBundleClient } from '@skip-mev/skipjs';
import { Coins, CreateTxOptions, LCDClient, MnemonicKey, MsgExecuteContract, MsgRevokeAuthorization, Wallet } from '@terra-money/terra.js';
import axios from 'axios';
import { warp_controller, WarpSdk } from '@terra-money/warp-sdk';
import { MyRedisClientType } from './util';

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

export const executeJob = async (wallet: Wallet, warpSdk: WarpSdk, jobId: string, private_key: Uint8Array) => {
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
        // const bundle = await skipBundleClient.signBundle([txString], private_key);
        // return await skipBundleClient.sendBundle(bundle, DESIRED_HEIGHT_FOR_BUNDLE, true);
    } catch (error) {
        // console.log({ error });
        if (axios.isAxiosError(error)) {
            return `Code=${error.response!.data!['code']} Message=${error.response!.data!['message']}`;
        }
        console.log('error broadcast');
        return error.message;
    }
};

export const findExecutableJobs = async (redisClient: MyRedisClientType, wallet: Wallet, warpSdk: WarpSdk, private_key: Uint8Array) => {
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
                console.log(await executeJob(wallet, warpSdk, jobId!, private_key));
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

export const processEvent = async (
    event,
    redisClient: MyRedisClientType,
    mnemonicKey: MnemonicKey,
    wallet: Wallet,
    warpSdk: WarpSdk
) => {
    const jobId = event.attributes.filter(attribute => attribute.hasOwnProperty('job_id'))[0].value;
    console.log(`new jobId ${jobId}`);
    const exist = await redisClient.sIsMember('ids', jobId);
    if (exist) {
        console.log('job already in redis');
    } else {
        console.log('sleep half block in case rpc has not synced to latest state yet');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        warpSdk.job(jobId).then((job: warp_controller.Job) => {
            warpSdk.condition.resolveCond(job.condition, job.vars).then((isActive: Boolean) => {
                if (isActive) {
                    console.log('executing now');
                    // sleep half block, setten rpc reports job not found
                    // await new Promise((resolve) => setTimeout(resolve, 10000));
                    console.log(await executeJob(wallet, warpSdk, jobId.id, mnemonicKey.privateKey));
                    console.log('done executing');
                } else {
                    console.log('not executable, save to redis');
                    saveJob(job, redisClient);
                }
            }).catch(err => {
                throw err
            })
        }).catch(err => {
            console.log('error getting job, probably due to rpc not updated to latest state', err);
            throw err
        })
    }
}
