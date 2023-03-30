import { MnemonicKey, TendermintSubscriptionResponse, Wallet } from '@terra-money/terra.js';
import { warp_controller, WarpSdk } from '@terra-money/warp-sdk';
import {
  getActionableEvents,
  getValueByKeyInAttributes,
  parseJobRewardFromStringToNumber,
  parseJobStatusFromStringToJobStatus,
  printAxiosError,
  sendErrorToSentry,
} from './util';
import { TMEvent, TMEventAttribute } from './schema';
import {
  EVENT_ATTRIBUTE_KEY_ACTION,
  EVENT_ATTRIBUTE_KEY_JOB_ID,
  EVENT_ATTRIBUTE_KEY_JOB_LAST_UPDATED_TIME,
  EVENT_ATTRIBUTE_KEY_JOB_REWARD,
  EVENT_ATTRIBUTE_KEY_JOB_STATUS,
  EVENT_ATTRIBUTE_VALUE_CREATE_JOB,
  EVENT_ATTRIBUTE_VALUE_DELETE_JOB,
  EVENT_ATTRIBUTE_VALUE_EVICT_JOB,
  EVENT_ATTRIBUTE_VALUE_EXECUTE_JOB,
  EVENT_ATTRIBUTE_VALUE_UPDATE_JOB,
  JOB_STATUS_EVICTED,
} from './constant';
import { saveJob } from './warp_read_helper';
import {
  removeJobFromRedis,
  updateJobLastUpdateTimeInRedis,
  updateJobRewardInRedis,
  saveToPendingJobSet,
} from './redis_helper';
import { RedisClientType } from 'redis';

export const handleJobCreation = async (
  redisClient: RedisClientType,
  mnemonicKey: MnemonicKey,
  wallet: Wallet,
  warpSdk: WarpSdk,
  jobId: string,
  attributes: TMEventAttribute[]
): Promise<void> => {
  const exist = await redisClient.sIsMember('ids', jobId);
  if (exist) {
    // TODO: technically this shouldn't happen
    // all jobs created after start listening to ws should already been added to redis
    console.log(`jobId ${jobId} already in redis`);
  } else {
    // const conditionStr = getValueByKeyInAttributes(attributes, EVENT_ATTRIBUTE_KEY_JOB_CONDITION)
    // const condition: warp_controller.Condition = JSON.parse(conditionStr)
    // var is not logged, we have to get it from chain, so only get condition from log is useless
    // const varStr = getValueByKeyInAttributes(attributes, )

    // we shouldn't need to sleep when running our own full node locally
    // console.log('sleep half block in case rpc has not synced to latest state yet');
    // await new Promise((resolve) => setTimeout(resolve, 1000));

    const job: warp_controller.Job = await warpSdk.job(jobId);
    await saveJob(job, redisClient);

    // do not try to execute job even if active
    // all execute job operation should be blocking, i can't get this ws callback work in blocking way
    // const isActive: boolean = await warpSdk.condition.resolveCond(job.condition, job.vars);
    // if (isActive) {
    //   console.log(`Find active job ${jobId} from WS, try executing!`);
    //   // sleep half block, setten rpc reports job not found if call immediately
    //   // await new Promise((resolve) => setTimeout(resolve, 10000));
    //   const currentSequence = parseAccountSequenceFromStringToNumber((await redisClient.get(REDIS_CURRENT_ACCOUNT_SEQUENCE))!);
    //   await executeJob(jobId, job.vars, wallet, mnemonicKey, currentSequence, warpSdk);
    //   await redisClient.set(REDIS_CURRENT_ACCOUNT_SEQUENCE, currentSequence + 1);
    // } else {
    //   console.log(`job ${jobId} not executable, save to redis`);
    // }
  }
};

export const handleJobExecution = async (
  redisClient: RedisClientType,
  jobId: string
): Promise<void> => {
  await removeJobFromRedis(redisClient, jobId);
};

export const handleJobDeletion = async (
  redisClient: RedisClientType,
  jobId: string
): Promise<void> => {
  await removeJobFromRedis(redisClient, jobId);
};

// update only supports updating the job reward or job name
export const handleJobUpdate = async (
  redisClient: RedisClientType,
  warpSdk: WarpSdk,
  jobId: string,
  newReward: number,
  updatedJobLastUpdateTimeStr: string
): Promise<void> => {
  await updateJobRewardInRedis(redisClient, warpSdk, jobId, newReward);
  await updateJobLastUpdateTimeInRedis(redisClient, jobId, updatedJobLastUpdateTimeStr);
};

// evict will leave job in evicted status (if no state rent cannot be paid or requeue set to false)
// requeue set to false means job will expire after 24 hour? as anyone can try to evict a job after 24 hour
// TODO: test eviction locally
export const handleJobEviction = async (
  redisClient: RedisClientType,
  warpSdk: WarpSdk,
  jobId: string,
  newStatus: warp_controller.JobStatus
): Promise<void> => {
  // theoretically status is either pending (enqueue is true and enough money to pay rent) or evicted
  // no need to update if job is pending, it should have been added to pending set earlier
  const updatedJobLastUpdateTimeStr = (await warpSdk.job(jobId)).last_update_time;
  await updateJobLastUpdateTimeInRedis(redisClient, jobId, updatedJobLastUpdateTimeStr);
  if (newStatus === JOB_STATUS_EVICTED) {
    // evicted means we should remove it
    await removeJobFromRedis(redisClient, jobId);
    console.log(`jobId ${jobId} new status is evicted, delete it from redis`);
  } else {
    // add job back to redis
    const job: warp_controller.Job = await warpSdk.job(jobId);
    await saveToPendingJobSet(job, redisClient);
    console.log(`jobId ${jobId} new status is still pending, added back to pending set`);
  }
};

export const processEvent = async (
  event: TMEvent,
  redisClient: RedisClientType,
  mnemonicKey: MnemonicKey,
  wallet: Wallet,
  warpSdk: WarpSdk
): Promise<void> => {
  const attributes = event.attributes;
  let jobId = getValueByKeyInAttributes(attributes, EVENT_ATTRIBUTE_KEY_JOB_ID);
  let jobAction = getValueByKeyInAttributes(attributes, EVENT_ATTRIBUTE_KEY_ACTION);
  console.log(`new event from WS, jobId: ${jobId}, jobAction: ${jobAction}`);
  let newRewardStr: string;
  let newReward: number;
  let newStatusStr: string;
  let newStatus: warp_controller.JobStatus;
  let updatedJobLastUpdateTimeStr: string;

  switch (jobAction) {
    case EVENT_ATTRIBUTE_VALUE_CREATE_JOB:
      handleJobCreation(redisClient, mnemonicKey, wallet, warpSdk, jobId, attributes);
      break;
    case EVENT_ATTRIBUTE_VALUE_EXECUTE_JOB:
      handleJobExecution(redisClient, jobId);
      break;
    case EVENT_ATTRIBUTE_VALUE_DELETE_JOB:
      handleJobDeletion(redisClient, jobId);
      break;
    case EVENT_ATTRIBUTE_VALUE_UPDATE_JOB:
      newRewardStr = getValueByKeyInAttributes(attributes, EVENT_ATTRIBUTE_KEY_JOB_REWARD);
      newReward = parseJobRewardFromStringToNumber(newRewardStr);
      updatedJobLastUpdateTimeStr = getValueByKeyInAttributes(
        attributes,
        EVENT_ATTRIBUTE_KEY_JOB_LAST_UPDATED_TIME
      );
      handleJobUpdate(redisClient, warpSdk, jobId, newReward, updatedJobLastUpdateTimeStr);
      break;
    case EVENT_ATTRIBUTE_VALUE_EVICT_JOB:
      newStatusStr = getValueByKeyInAttributes(attributes, EVENT_ATTRIBUTE_KEY_JOB_STATUS);
      newStatus = parseJobStatusFromStringToJobStatus(newStatusStr);
      // evict_job doesn't log last_update_time so we have to query job to get it
      // updatedJobLastUpdateTimeStr = getValueByKeyInAttributes(attributes, EVENT_ATTRIBUTE_KEY_JOB_LAST_UPDATED_TIME);
      handleJobEviction(redisClient, warpSdk, jobId, newStatus);
      break;
    default:
      throw new Error(`unknown jobAction: ${jobAction}`);
  }
};

export const processWebSocketEvent = async (
  tmResponse: TendermintSubscriptionResponse,
  redisClient: RedisClientType,
  mnemonicKey: MnemonicKey,
  wallet: Wallet,
  warpSdk: WarpSdk
): Promise<void> => {
  console.log('new tx on warp_controller contract!');
  // console.log('tx log: ' + tmResponse.value.TxResult.result.log)
  // console.log('tx type type: ' + tmResponse.type);
  // usually actionableEvents should only have 1 event, since 1 tx only has 1 wasm event
  // TODO: check if create multiple jobs in 1 tx
  const actionableEvents = getActionableEvents(tmResponse);
  actionableEvents.forEach(
    async (event) =>
      await processEvent(event, redisClient, mnemonicKey, wallet, warpSdk).catch((e: any) => {
        printAxiosError(e);
        sendErrorToSentry(e);
        throw e;
      })
  );
};
