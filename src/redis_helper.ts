import {
  REDIS_PENDING_JOB_ID_SET,
  REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET,
  REDIS_PENDING_JOB_ID_TO_CONDITION_MAP,
  REDIS_PENDING_JOB_ID_TO_MESSAGES_MAP,
  REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP,
} from './constant';
import { createClient } from 'redis';

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

export const removeExecutedJobFromRedis = async (
  redisClient: MyRedisClientType,
  jobId: string
) => {
  await Promise.all([
    redisClient.sRem(REDIS_PENDING_JOB_ID_SET, jobId),
    redisClient.zRem(REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET, jobId),
    redisClient.hDel(REDIS_PENDING_JOB_ID_TO_CONDITION_MAP, jobId),
    redisClient.hDel(REDIS_PENDING_JOB_ID_TO_MESSAGES_MAP, jobId),
    redisClient.hDel(REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP, jobId),
  ]).then((_) => console.log(`removed jobId ${jobId} from redis pending jobs`));
};
