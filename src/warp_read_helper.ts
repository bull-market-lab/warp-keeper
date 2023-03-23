import { MnemonicKey, Wallet } from '@terra-money/terra.js';
import { warp_controller, WarpSdk } from '@terra-money/warp-sdk';
import { MyRedisClientType, removeJobFromRedis, saveToPendingJobSet } from './redis_helper';
import { executeJob } from './warp_write_helper';
import {
  QUERY_JOB_LIMIT,
  JOB_STATUS_PENDING,
  REDIS_CURRENT_ACCOUNT_SEQUENCE,
  REDIS_PENDING_JOB_ID_SET,
  REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET,
  REDIS_PENDING_JOB_ID_TO_CONDITION_MAP,
  REDIS_PENDING_JOB_ID_TO_MESSAGES_MAP,
  REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP,
} from './constant';
import {
  isRewardSufficient,
  parseAccountSequenceFromStringToNumber,
  parseJobRewardFromStringToNumber,
  printAxiosError,
} from './util';

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
  redisClient: MyRedisClientType
): Promise<void> => {
  let reward = parseJobRewardFromStringToNumber(job.reward);
  if (isRewardSufficient(reward)) {
    saveToPendingJobSet(job, redisClient);
  }
};

export const saveAllPendingJobs = async (
  redisClient: MyRedisClientType,
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

  Promise.all(saveJobPromises).then((_) => {
    console.log('done saving pending jobs to redis');
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
        `Error processing condition of job ${jobId}, we will execute invalid condition job because we get still reward in this case, error: ${e}`
      );
      printAxiosError(e);
      return true;
    });
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
    console.log(`pending jobs count ${await redisClient.sCard(REDIS_PENDING_JOB_ID_SET)}`);
    const allJobIds: string[] = await redisClient.sMembers(REDIS_PENDING_JOB_ID_SET);
    // TODO: is it possible to construct a msg to resolve multiple condition in 1 shot?
    // TODO: come up with a better algorithm to find which job to execute when there are multiple executable jobs
    // TODO: think about in what order should we scan the pending jobs
    for (let i = allJobIds.length - 1; i >= 0; i--) {
      const jobId: string = allJobIds[i]!;
      const jobConditionStr: string = (await redisClient.hGet(
        REDIS_PENDING_JOB_ID_TO_CONDITION_MAP,
        jobId
      ))!;
      const jobCondition: warp_controller.Condition = JSON.parse(jobConditionStr);
      const jobVariablesStr: string = (await redisClient.hGet(
        REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP,
        jobId
      ))!;
      const jobVariables: warp_controller.Variable[] = JSON.parse(jobVariablesStr).map(
        (jobVariable: string) => JSON.parse(jobVariable)
      );
      const isActive = await isJobExecutable(jobId, jobCondition, jobVariables, warpSdk);
      if (isActive) {
        console.log(`Find active job ${jobId} from redis, try executing!`);
        const currentSequence = parseAccountSequenceFromStringToNumber(
          (await redisClient.get(REDIS_CURRENT_ACCOUNT_SEQUENCE))!
        );
        await executeJob(jobId, jobVariables, wallet, mnemonicKey, currentSequence, warpSdk);
        await removeJobFromRedis(redisClient, jobId);
        await redisClient.set(REDIS_CURRENT_ACCOUNT_SEQUENCE, currentSequence + 1);
      }
    }

    console.log(`loop ${counter}, sleep 1s to avoid stack overflow`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    counter++;
  }
};
