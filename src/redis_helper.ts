import {
  REDIS_LOW_REWARD_PENDING_JOB_ID_SET,
  REDIS_PENDING_JOB_ID_SET,
  REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET,
  REDIS_PENDING_JOB_ID_TO_CONDITION_MAP,
  REDIS_PENDING_JOB_ID_TO_MESSAGES_MAP,
  REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP,
} from './constant';
import { createClient } from 'redis';
import { WarpSdk, warp_controller } from '@terra-money/warp-sdk';
import { saveJob } from './warp_read_helper';
import { isRewardTooLow, parseJobRewardFromStringToNumber } from './util';

export type MyRedisClientType = ReturnType<typeof createClient>;
export const initRedisClient = async (): Promise<MyRedisClientType> => {
  const redisClient = createClient();
  redisClient.on('error', (err) => {
    console.log('Redis Client Error', err);
    throw err;
  });
  await redisClient.connect();
  return redisClient;
};

export const removeLowRewardJob = async (
  redisClient: MyRedisClientType,
  jobId: string
): Promise<void> => {
  await redisClient.sRem(REDIS_LOW_REWARD_PENDING_JOB_ID_SET, jobId);
};

export const removeJobFromRedis = async (
  redisClient: MyRedisClientType,
  jobId: string
): Promise<void> => {
  await Promise.all([
    redisClient.sRem(REDIS_PENDING_JOB_ID_SET, jobId),
    redisClient.zRem(REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET, jobId),
    redisClient.hDel(REDIS_PENDING_JOB_ID_TO_CONDITION_MAP, jobId),
    redisClient.hDel(REDIS_PENDING_JOB_ID_TO_MESSAGES_MAP, jobId),
    redisClient.hDel(REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP, jobId),

    redisClient.sRem(REDIS_LOW_REWARD_PENDING_JOB_ID_SET, jobId),
  ]).then((_) => console.log(`removed jobId ${jobId} from redis pending jobs`));
};

export const updateJobRewardInRedis = async (
  redisClient: MyRedisClientType,
  warpSdk: WarpSdk,
  jobId: string,
  newAmount: number
): Promise<void> => {
  const existInPendingJobSet = await redisClient.sIsMember(REDIS_PENDING_JOB_ID_SET, jobId);
  // original reward is already enough
  if (existInPendingJobSet) {
    await redisClient.zAdd(REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET, {
      score: newAmount,
      value: jobId,
    });
    return;
  }
  // original reward too low, if new reward is high enough we remove it from low reward set
  // and add it to normal reward set
  if (!isRewardTooLow(newAmount)) {
    const job: warp_controller.Job = await warpSdk.job(jobId);
    await removeLowRewardJob(redisClient, jobId);
    await saveToPendingJobSet(job, redisClient);
  }
};

export const saveToLowRewardPendingJobSet = async (
  job: warp_controller.Job,
  redisClient: MyRedisClientType
): Promise<void> => {
  await redisClient.sAdd(REDIS_LOW_REWARD_PENDING_JOB_ID_SET, job.id);
};

export const saveToPendingJobSet = async (
  job: warp_controller.Job,
  redisClient: MyRedisClientType
): Promise<void> => {
  let reward = parseJobRewardFromStringToNumber(job.reward);
  await redisClient.sAdd(REDIS_PENDING_JOB_ID_SET, job.id);
  await redisClient.zAdd(REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET, {
    score: reward,
    value: job.id,
  });
  await redisClient.hSet(
    REDIS_PENDING_JOB_ID_TO_CONDITION_MAP,
    job.id,
    JSON.stringify(job.condition)
  );
  // msgs should never be empty
  await redisClient.hSet(REDIS_PENDING_JOB_ID_TO_MESSAGES_MAP, job.id, JSON.stringify(job.msgs));
  // vars could be empty
  if (job.vars && job.vars.length !== 0) {
    await redisClient.hSet(
      REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP,
      job.id,
      JSON.stringify(job.vars.map((jobVar) => JSON.stringify(jobVar)))
    );
  } else {
    // need to specify this case manually, i don't know why it error without this
    await redisClient.hSet(REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP, job.id, '[]');
  }
};
