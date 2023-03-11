// @ts-ignore
import { SkipBundleClient } from '@skip-mev/skipjs';
// @ts-ignore
import { Coins, CreateTxOptions, LCDClient, MnemonicKey, MsgExecuteContract, MsgRevokeAuthorization, Wallet } from '@terra-money/terra.js';
import axios from 'axios';
import { warp_controller, WarpSdk } from '@terra-money/warp-sdk';
import { createClient } from 'redis';

type redisClientType = ReturnType<typeof createClient>

export const saveJob = async (job: warp_controller.Job, redisClient: redisClientType) => {
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

// @ts-ignore
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
            // @ts-ignore
            return `Code=${error.response!.data!['code']} Message=${error.response!.data!['message']}`;
        }
        console.log('error broadcast');
        // @ts-ignore
        return error.message;
    }
};

export const findExecutableJobs = async (redisClient: redisClientType, wallet: Wallet, warpSdk: WarpSdk, private_key: Uint8Array) => {
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

export const saveAllJobs = async (redisClient: redisClientType, warpSdk: WarpSdk) => {
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
