import axios from 'axios';
import { MnemonicKey, Wallet } from '@terra-money/terra.js';
import { warp_controller, WarpSdk } from '@terra-money/warp-sdk';
import { MyRedisClientType, removeExecutedJobFromRedis } from './redis_helper';
import { executeJob } from './warp_write_helper';
import {
  QUERY_JOB_LIMIT,
  QUERY_JOB_STATUS_PENDING,
  REDIS_LOW_REWARD_PENDING_JOB_ID_SET,
  REDIS_PENDING_JOB_ID_SET,
  REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET,
  REDIS_PENDING_JOB_ID_TO_CONDITION_MAP,
  REDIS_PENDING_JOB_ID_TO_MESSAGES_MAP,
  REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP,
} from './constant';

export const getWarpAccountAddressByOwner = async (
  wallet: Wallet,
  warpSdk: WarpSdk
) => {
  return warpSdk
    .account(wallet.key.accAddress)
    .then((warp_account: warp_controller.Account) => {
      return warp_account.account;
    })
    .catch((err) => {
      throw err;
    });
};

export const saveJob = async (
  job: warp_controller.Job,
  redisClient: MyRedisClientType
): Promise<void> => {
  // TODO: check existence before adding to redis, not a big problem now we use unique data structure anyway
  // limit to 0.001 luna
  // TODO: maybe use bigint in the future
  // but reward is usually low so it shouldn't overflow
  let reward = Number(job.reward.substring(0, job.reward.length - 3));
  if (reward === 0) {
    redisClient.sAdd(REDIS_LOW_REWARD_PENDING_JOB_ID_SET, job.id);
    return;
  }
  redisClient.sAdd(REDIS_PENDING_JOB_ID_SET, job.id);
  redisClient.zAdd(REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET, {
    score: reward,
    value: job.id,
  });
  redisClient.hSet(
    REDIS_PENDING_JOB_ID_TO_CONDITION_MAP,
    job.id,
    JSON.stringify(job.condition)
  );
  // msgs should never be empty
  redisClient.hSet(
    REDIS_PENDING_JOB_ID_TO_MESSAGES_MAP,
    job.id,
    JSON.stringify(job.msgs)
  );
  // vars could be empty
  if (job.vars && job.vars.length !== 0) {
    redisClient.hSet(
      REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP,
      job.id,
      JSON.stringify(job.vars.map((jobVar) => JSON.stringify(jobVar)))
    );
  } else {
    // need to specify this case manually, i don't know why it error without this
    redisClient.hSet(REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP, job.id, '[]');
  }
};

export const saveAllJobs = async (
  redisClient: MyRedisClientType,
  warpSdk: WarpSdk
): Promise<void> => {
  const metricPrefix = 'initial_pending_job_search';
  let startAfter: warp_controller.JobIndex | null = null;
  while (true) {
    try {
      const jobs: warp_controller.Job[] = await warpSdk.jobs({
        limit: QUERY_JOB_LIMIT,
        start_after: startAfter,
        job_status: QUERY_JOB_STATUS_PENDING,
      });

      if (jobs.length === 0) {
        console.log(`${metricPrefix}.exhausted_all_pending_jobs`);
        break;
      }

      jobs.forEach((job) => {
        saveJob(job, redisClient);
      });

      const lastJobInPage = jobs[jobs.length - 1];
      console.log(`${metricPrefix}.last_job_in_page_${lastJobInPage?.id!}`);
      startAfter = { _0: lastJobInPage?.reward!, _1: lastJobInPage?.id! };
    } catch (e: any) {
      if (axios.isAxiosError(e)) {
        const msg = JSON.stringify(e.toJSON())
        throw new Error(`${metricPrefix}.unknown_error.${msg}`);
      }
      throw new Error(`${metricPrefix}.unknown_error.${e}`);
    }
  }
};

// dead loop check which job becomes executable and execute it
export const findExecutableJobs = async (
  redisClient: MyRedisClientType,
  wallet: Wallet,
  mnemonicKey: MnemonicKey,
  warpSdk: WarpSdk
): Promise<void> => {
  let counter = 0;
  while (true) {
    console.log(
      `pending jobs count ${await redisClient.sCard(REDIS_PENDING_JOB_ID_SET)}`
    );
    const allJobIds: string[] = await redisClient.sMembers(
      REDIS_PENDING_JOB_ID_SET
    );
    for (let i = allJobIds.length - 1; i >= 0; i--) {
      const jobId = allJobIds[i]!;

      const jobConditionStr = await redisClient.hGet(
        REDIS_PENDING_JOB_ID_TO_CONDITION_MAP,
        jobId
      );
      const jobCondition: warp_controller.Condition = JSON.parse(
        jobConditionStr!
      );

      const jobVarsStr = await redisClient.hGet(
        REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP,
        jobId
      );
      const jobVars = JSON.parse(jobVarsStr!).map((jobVar: string) =>
        JSON.parse(jobVar)
      );

      let isActive = false;
      try {
        // TODO: update this after sdk export resolveCond directly
        isActive = await warpSdk.condition.resolveCond(jobCondition, jobVars);
      } catch (e) {
        console.log(
          `Error processing condition of job ${jobId}, we will execute invalid condition job because we get still reward in this case, error: ${e}`
        );
        isActive = true;
      }
      if (isActive) {
        console.log(`Find active job ${jobId} from redis, try executing!`);
        await executeJob(jobId, wallet, mnemonicKey, warpSdk).then(
          async (_) => await removeExecutedJobFromRedis(redisClient, jobId)
        );
      }
    }

    console.log(`loop ${counter}, sleep 1s`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    counter++;
  }
};
