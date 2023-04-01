import {
  REDIS_CURRENT_ACCOUNT_SEQUENCE,
  REDIS_EVICTABLE_JOB_ID_SET,
  REDIS_EVICTION_TIME,
  REDIS_EXECUTABLE_JOB_ID_SET,
  REDIS_PENDING_JOB_ID_SET,
  REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET,
  REDIS_PENDING_JOB_ID_TO_CONDITION_MAP,
  REDIS_PENDING_JOB_ID_TO_LAST_UPDATE_TIME_MAP,
  REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP,
} from './constant';
import { createClient, RedisClientType } from 'redis';

import { WarpSdk, warp_controller } from '@terra-money/warp-sdk';
import {
  isRewardSufficient,
  parseAccountSequenceFromStringToNumber,
  parseJobRewardFromStringToNumber,
} from './util';
import { REDIS_ENDPOINT } from './env';

export const initRedisClient = async (): Promise<RedisClientType> => {
  const redisClient: RedisClientType = createClient({
    url: REDIS_ENDPOINT,
  });
  redisClient.on('error', (err) => {
    console.log('redis client error', err);
    throw err;
  });
  redisClient.on('connect', (_) => {
    console.log('redis connected');
  });
  redisClient.on('disconnect', (_) => {
    console.log('redis disconnected');
  });
  await redisClient.connect();
  return redisClient;
};

export const removeJobFromRedis = async (
  redisClient: RedisClientType,
  jobId: string
): Promise<void> => {
  await Promise.all([
    redisClient.sRem(REDIS_PENDING_JOB_ID_SET, jobId),
    redisClient.zRem(REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET, jobId),
    redisClient.hDel(REDIS_PENDING_JOB_ID_TO_CONDITION_MAP, jobId),
    redisClient.hDel(REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP, jobId),
    redisClient.hDel(REDIS_PENDING_JOB_ID_TO_LAST_UPDATE_TIME_MAP, jobId),
    redisClient.sRem(REDIS_EXECUTABLE_JOB_ID_SET, jobId),
    redisClient.sRem(REDIS_EVICTABLE_JOB_ID_SET, jobId),
  ]);
};

export const removeJobFromEvictableSetInRedis = async (
  redisClient: RedisClientType,
  jobId: string
): Promise<void> => {
  await redisClient.sRem(REDIS_EVICTABLE_JOB_ID_SET, jobId);
};

export const updateJobRewardInRedis = async (
  redisClient: RedisClientType,
  warpSdk: WarpSdk,
  jobId: string,
  newAmount: number
): Promise<void> => {
  if (isRewardSufficient(newAmount)) {
    const job: warp_controller.Job = await warpSdk.job(jobId);
    // if job already exists in redis, we will just override, no big deal
    await saveToPendingJobSet(job, redisClient);
  }
};

export const updateJobLastUpdateTimeInRedis = async (
  redisClient: RedisClientType,
  jobId: string,
  updatedJobLastUpdateTimeStr: string
): Promise<void> => {
  await redisClient.hSet(
    REDIS_PENDING_JOB_ID_TO_LAST_UPDATE_TIME_MAP,
    jobId,
    updatedJobLastUpdateTimeStr
  );
};

export const saveToPendingJobSet = async (
  job: warp_controller.Job,
  redisClient: RedisClientType
): Promise<void> => {
  let reward = parseJobRewardFromStringToNumber(job.reward);
  await redisClient.zAdd(REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET, {
    score: reward,
    value: job.id,
  });
  await redisClient.hSet(
    REDIS_PENDING_JOB_ID_TO_CONDITION_MAP,
    job.id,
    JSON.stringify(job.condition)
  );
  await redisClient.hSet(
    REDIS_PENDING_JOB_ID_TO_LAST_UPDATE_TIME_MAP,
    job.id,
    job.last_update_time
  );
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
  // set REDIS_PENDING_JOB_ID_SET in the last step to avoid the situation where id is there but others are not
  await redisClient.sAdd(REDIS_PENDING_JOB_ID_SET, job.id);
};

export const setEvictionTimeInRedis = async (
  redisClient: RedisClientType,
  warpSdk: WarpSdk
): Promise<void> => {
  warpSdk.config().then((warpConfig) => {
    // TODO: understand how it's calculated in the contract (when to use t_min and when use t_max - something)
    // in current deployment t_min is same as t_max (both 1 day in mainnet)
    redisClient.set(REDIS_EVICTION_TIME, warpConfig.t_min);
  });
};

export const getJobConditionFromRedis = async (
  redisClient: RedisClientType,
  jobId: string
): Promise<warp_controller.Condition> => {
  const jobConditionStr: string = (await redisClient.hGet(
    REDIS_PENDING_JOB_ID_TO_CONDITION_MAP,
    jobId
  ))!;
  const jobCondition: warp_controller.Condition = JSON.parse(jobConditionStr);
  return jobCondition;
};

export const getJobVariablesFromRedis = async (
  redisClient: RedisClientType,
  jobId: string
): Promise<warp_controller.Variable[]> => {
  const jobVariablesStr: string = (await redisClient.hGet(
    REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP,
    jobId
  ))!;
  const jobVariables: warp_controller.Variable[] = JSON.parse(jobVariablesStr).map(
    (jobVariable: string) => JSON.parse(jobVariable)
  );
  return jobVariables;
};

export const getAccountSequenceFromRedis = async (
  redisClient: RedisClientType
): Promise<number> => {
  return parseAccountSequenceFromStringToNumber(
    (await redisClient.get(REDIS_CURRENT_ACCOUNT_SEQUENCE))!
  );
};

export const incrementAccountSequenceInRedis = async (
  redisClient: RedisClientType,
  currentAccountSequence: number
): Promise<void> => {
  await redisClient.set(REDIS_CURRENT_ACCOUNT_SEQUENCE, currentAccountSequence + 1);
};
