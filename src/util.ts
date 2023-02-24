import { SkipBundleClient } from '@skip-mev/skipjs';
import { Coins, CreateTxOptions, MsgExecuteContract, Wallet } from '@terra-money/terra.js';
import axios from 'axios';
import { WarpSdk } from '@terra-money/warp-sdk';
import { warp_controller } from './types/contracts/'
import { createClient } from 'redis';

type redisClientType = ReturnType<typeof createClient>

export const saveJob = async (job: warp_controller.Job, redis_client: redisClientType) => {
    // limit to 0.001 luna
    let reward = Number(job.reward.substring(0, job.reward.length - 3));
    if (reward === 0) {
        console.log('reward too low, less than 0.001 luna, ignore the job, will add back if creator updates reward later');
        return;
    }
    redis_client.sAdd('ids', job.id);
    redis_client.zAdd('ids_sort_by_reward', { score: reward, value: job.id });
    redis_client.hSet('conditions', job.id, JSON.stringify(job.condition));
    redis_client.hSet('messages', job.id, JSON.stringify(job.msgs));
    if (job.vars && job.vars.length !== 0) {
        redis_client.hSet('vars', job.id, JSON.stringify(job.vars.map((job_var) => JSON.stringify(job_var))));
    } else {
        redis_client.hSet('vars', job.id, '[]');
    }
};

function executeMsg<T extends {}>(sender: string, contract: string, msg: T, coins?: Coins.Input) {
    return new MsgExecuteContract(sender, contract, msg, coins);
}
export const executeJob = async (wallet: Wallet, warp_sdk: WarpSdk, job_id: string, private_key: Uint8Array) => {
    const msg = executeMsg<Extract<warp_controller.ExecuteMsg, { execute_job: warp_controller.ExecuteJobMsg }>>(
        wallet.key.accAddress,
        warp_sdk.contractAddress,
        {
            execute_job: { id: job_id },
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
        const txString = Buffer.from(tx.toBytes()).toString('base64');
        const DESIRED_HEIGHT_FOR_BUNDLE = 0;
        const skipBundleClient = new SkipBundleClient('http://pisco-1-api.skip.money');
        const bundle = await skipBundleClient.signBundle([txString], private_key);
        return await skipBundleClient.sendBundle(bundle, DESIRED_HEIGHT_FOR_BUNDLE, true);
    } catch (error) {
        // console.log({ error });
        if (axios.isAxiosError(error)) {
            return `Code=${error.response!.data!['code']} Message=${error.response!.data!['message']}`;
        }
        console.log('error broadcast');
        // @ts-ignore
        return error.message;
    }
};

export const findExecutableJobs = async (redis_client: redisClientType, wallet: Wallet, warp_sdk: WarpSdk, private_key: Uint8Array) => {
    let counter = 0;
    while (true) {
        console.log(`pending jobs count ${await redis_client.sCard('ids')}`);

        const all_job_ids: string[] = await redis_client.sMembers('ids');
        for (let i = all_job_ids.length - 1; i >= 0; i--) {
            const job_id = all_job_ids[i];

            const condition_s = await redis_client.hGet('conditions', job_id);
            const job_condition = JSON.parse(condition_s!);

            const var_s = await redis_client.hGet('vars', job_id);
            const job_variables = JSON.parse(var_s!).map((job_var: string) => JSON.parse(job_var));

            let isActive = false;
            try {
                isActive = await warp_sdk.condition.resolveCond(job_condition, job_variables);
            } catch (e) {
                console.log(`Error processing condition of job ${job_id}`, e);
                console.log(
                    'For jobs with invalid condition, we still try to execute them because we get reward from failed jobs'
                );
                isActive = true;
            }
            if (isActive) {
                console.log(`Find active job ${job_id} from redis, try executing!`);
                console.log(await executeJob(wallet, warp_sdk, job_id, private_key));
                await redis_client.sRem('ids', job_id);
            } else {
                // console.log("inactive")
            }
        }

        console.log(`loop ${counter}, sleep 1s`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        counter++;
    }
};

export const saveAllJobs = async (redis_client: redisClientType, warp_sdk: WarpSdk) => {
    let start_after: warp_controller.JobIndex | null = null;
    const limit = 50;
    while (true) {
        try {
            const jobs: warp_controller.Job[] = await warp_sdk.jobs({ limit, start_after, job_status: 'Pending' });
            // we have exhausted all pending jobs
            if (jobs.length === 0) {
                break;
            }

            jobs.forEach((job) => {
                saveJob(job, redis_client);
            });

            const lastJobInPage = jobs[jobs.length - 1];
            console.log(`LAST JOB IN PAGE: ${lastJobInPage.id}`);
            start_after = { _0: lastJobInPage.reward, _1: lastJobInPage.id };
        } catch (e) {
            console.log(e);
            throw new Error('unknown error when saving pending jobs to redis');
        }
    }
};
