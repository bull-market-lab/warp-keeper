import { Wallet } from '@terra-money/terra.js';
import { warp_controller, WarpSdk } from '@terra-money/warp-sdk';
import {
  getJobConditionFromRedis,
  getJobVariablesFromRedis,
  saveToPendingJobSet,
} from './redis_helper';
import {
  QUERY_JOB_LIMIT,
  JOB_STATUS_PENDING,
  REDIS_PENDING_JOB_ID_SET,
  REDIS_EXECUTABLE_JOB_ID_SET,
  MONITOR_SLEEP_MILLISECONDS,
  REDIS_PENDING_JOB_ID_TO_LAST_UPDATE_TIME_MAP,
  REDIS_EVICTABLE_JOB_ID_SET,
  REDIS_EVICTION_TIME,
} from './constant';
import {
  isRewardSufficient,
  parseTimeFromStringToNumber,
  parseJobRewardFromStringToNumber,
  printAxiosError,
  getCurrentBlockTimeInUnixTimestampInSeconds,
} from './util';
import { RedisClientType } from 'redis';

export const getWarpAccountAddressByOwner = async (
  wallet: Wallet,
  warpSdk: WarpSdk
): Promise<string> => {
  return warpSdk.account(wallet.key.accAddress).then((warp_account: warp_controller.Account) => {
    return warp_account.account;
  });
};

export const saveJob = async (
  job: warp_controller.Job,
  redisClient: RedisClientType
): Promise<void> => {
  let reward = parseJobRewardFromStringToNumber(job.reward);
  if (isRewardSufficient(reward)) {
    await saveToPendingJobSet(job, redisClient);
  }
};

export const saveAllPendingJobs = async (
  redisClient: RedisClientType,
  warpSdk: WarpSdk
): Promise<void> => {
  console.log('start saving pending jobs to redis');
  let startAfter: warp_controller.JobIndex | null = null;
  const saveJobPromises: Promise<void>[] = [];
  while (true) {
    const jobs: warp_controller.Job[] = await warpSdk.jobs({
      limit: QUERY_JOB_LIMIT,
      start_after: startAfter,
      job_status: JOB_STATUS_PENDING,
    });

    if (jobs.length === 0) {
      break;
    }

    jobs.forEach((job) => {
      saveJobPromises.push(saveJob(job, redisClient));
    });

    const lastJobInPage = jobs[jobs.length - 1];
    startAfter = { _0: lastJobInPage?.reward!, _1: lastJobInPage?.id! };
  }

  await Promise.all(saveJobPromises).then((_) => {
    console.log(`done saving ${saveJobPromises.length} pending jobs to redis`);
  });
};

export const isJobExecutable = async (
  jobId: string,
  jobCondition: warp_controller.Condition,
  jobVariables: warp_controller.Variable[],
  warpSdk: WarpSdk
): Promise<boolean> => {
  return warpSdk.condition
    .resolveCond(jobCondition, jobVariables)
    .then((isActive: boolean) => isActive)
    .catch((e: any) => {
      console.log(
        `jobId ${jobId} has error processing condition, we will execute invalid condition job because we get still reward in this case, error: ${e}`
      );
      printAxiosError(e);
      return true;
    });
};

export const isJobEvictable = async (
  redisClient: RedisClientType,
  warpSdk: WarpSdk,
  lastUpdateTimeStr: string
): Promise<boolean> => {
  const currentTimeInSeconds = await getCurrentBlockTimeInUnixTimestampInSeconds(
    warpSdk.wallet.lcd
  );
  const lastUpdateTime = parseTimeFromStringToNumber(lastUpdateTimeStr);
  const evictionTimeStr = await redisClient.get(REDIS_EVICTION_TIME);
  const evictionTime = parseTimeFromStringToNumber(evictionTimeStr!);
  return currentTimeInSeconds - lastUpdateTime > evictionTime + 6;
};

// dead loop check which job becomes executable and execute it
export const findExecutableJobsAndEvictableJobs = async (
  redisClient: RedisClientType,
  warpSdk: WarpSdk
): Promise<void> => {
  while (true) {
    const allJobIds: string[] = await redisClient.sMembers(REDIS_PENDING_JOB_ID_SET);
    // TODO: is it possible to construct a msg to resolve multiple condition in 1 shot?
    // TODO: come up with a better algorithm to find which job to execute when there are multiple executable jobs
    // TODO: think about in what order should we scan the pending jobs
    for (let i = allJobIds.length - 1; i >= 0; i--) {
      const jobId: string = allJobIds[i]!;
      const jobCondition = await getJobConditionFromRedis(redisClient, jobId);
      const jobVariables = await getJobVariablesFromRedis(redisClient, jobId);
      const jobLastUpdateTimeStr: string = (await redisClient.hGet(
        REDIS_PENDING_JOB_ID_TO_LAST_UPDATE_TIME_MAP,
        jobId
      ))!;
      const isExecutable = await isJobExecutable(jobId, jobCondition, jobVariables, warpSdk);
      const isEvictable = await isJobEvictable(redisClient, warpSdk, jobLastUpdateTimeStr);
      if (isExecutable && !isEvictable) {
        console.log(`jobId ${jobId} found executable from redis, let executor to execute it`);
        await redisClient.sAdd(REDIS_EXECUTABLE_JOB_ID_SET, jobId);
        await redisClient.sRem(REDIS_PENDING_JOB_ID_SET, jobId);
      } else if (!isExecutable && isEvictable) {
        console.log(`jobId ${jobId} found evictable from redis, let evictor to evict it`);
        await redisClient.sAdd(REDIS_EVICTABLE_JOB_ID_SET, jobId);
        await redisClient.sRem(REDIS_PENDING_JOB_ID_SET, jobId);
      } else if (isExecutable && isEvictable) {
        // when a job is both executable and evictable, we will execute it as that resolves in higher reward
        // eviction reward is 0.01 LUNA, execution reward is at least 0.01 LUNA
        console.log(
          `jobId ${jobId} found both executable and evictable from redis, let executor to execute it!`
        );
        await redisClient.sAdd(REDIS_EXECUTABLE_JOB_ID_SET, jobId);
        await redisClient.sRem(REDIS_PENDING_JOB_ID_SET, jobId);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, MONITOR_SLEEP_MILLISECONDS));
  }
};
