import axios from 'axios';
import { MnemonicKey, TendermintSubscriptionResponse, Wallet } from '@terra-money/terra.js';
import { warp_controller, WarpSdk } from '@terra-money/warp-sdk';
import { getActionableEvents, getValueByKeyInAttributes } from './util';
import { TMEvent, TMEventAttribute } from './schema';
import {
  EVENT_ATTRIBUTE_KEY_ACTION,
  EVENT_ATTRIBUTE_KEY_JOB_CONDITION,
  EVENT_ATTRIBUTE_KEY_JOB_ID,
  EVENT_ATTRIBUTE_VALUE_CREATE_JOB,
  EVENT_ATTRIBUTE_VALUE_DELETE_JOB,
  EVENT_ATTRIBUTE_VALUE_EVICT_JOB,
  EVENT_ATTRIBUTE_VALUE_EXECUTE_JOB,
  EVENT_ATTRIBUTE_VALUE_UPDATE_JOB,
  REDIS_CURRENT_ACCOUNT_SEQUENCE,
} from './constant';
import { saveJob } from './warp_read_helper';
import { executeJob } from './warp_write_helper';
import { MyRedisClientType } from './redis_helper';

export const handleJobCreation = async (
  jobId: string,
  attributes: TMEventAttribute[],
  redisClient: MyRedisClientType,
  mnemonicKey: MnemonicKey,
  wallet: Wallet,
  warpSdk: WarpSdk
) => {
  const exist = await redisClient.sIsMember('ids', jobId);
  if (exist) {
    console.log('job already in redis');
  } else {
    // const conditionStr = getValueByKeyInAttributes(attributes, EVENT_ATTRIBUTE_KEY_JOB_CONDITION)
    // const condition: warp_controller.Condition = JSON.parse(conditionStr)
    // var is not logged, we have to get it from chain, so only get condition from log is useless
    // const varStr = getValueByKeyInAttributes(attributes, )

    // we shouldn't need to sleep when running our own full node locally
    // console.log('sleep half block in case rpc has not synced to latest state yet');
    // await new Promise((resolve) => setTimeout(resolve, 1000));

    const job: warp_controller.Job = await warpSdk.job(jobId);
    const isActive: boolean = await warpSdk.condition.resolveCond(job.condition, job.vars);
    if (isActive) {
      console.log(`Find active job ${jobId} from WS, try executing!`);
      // sleep half block, setten rpc reports job not found if call immediately
      // await new Promise((resolve) => setTimeout(resolve, 10000));
      const currentSequence = parseInt((await redisClient.get(REDIS_CURRENT_ACCOUNT_SEQUENCE))!);
      await executeJob(jobId, job.vars, wallet, mnemonicKey, currentSequence, warpSdk);
      await redisClient.set(REDIS_CURRENT_ACCOUNT_SEQUENCE, currentSequence + 1);
      console.log(`done executing job ${jobId}`);
    } else {
      console.log(`job ${jobId} not executable, save to redis`);
      saveJob(job, redisClient);
    }
  }
};

export const handleJobExecution = async () => {
  // TODO:
};

export const handleJobUpdate = async () => {
  // TODO:
};

export const handleJobDeletion = async () => {
  // TODO:
};

export const handleJobEviction = async () => {
  // TODO:
};

export const processEvent = async (
  event: TMEvent,
  redisClient: MyRedisClientType,
  mnemonicKey: MnemonicKey,
  wallet: Wallet,
  warpSdk: WarpSdk
) => {
  const attributes = event.attributes;
  let jobId = getValueByKeyInAttributes(attributes, EVENT_ATTRIBUTE_KEY_JOB_ID);
  let jobAction = getValueByKeyInAttributes(attributes, EVENT_ATTRIBUTE_KEY_ACTION);
  console.log(`new event from WS, jobId: ${jobId}, jobAction: ${jobAction}`);

  switch (jobAction) {
    case EVENT_ATTRIBUTE_VALUE_CREATE_JOB:
      handleJobCreation(jobId, attributes, redisClient, mnemonicKey, wallet, warpSdk);
      break;
    case EVENT_ATTRIBUTE_VALUE_UPDATE_JOB:
      handleJobUpdate();
      break;
    case EVENT_ATTRIBUTE_VALUE_EXECUTE_JOB:
      handleJobExecution();
      break;
    case EVENT_ATTRIBUTE_VALUE_EVICT_JOB:
      handleJobEviction();
      break;
    case EVENT_ATTRIBUTE_VALUE_DELETE_JOB:
      handleJobDeletion();
      break;
    default:
      throw new Error(`unknown jobAction: ${jobAction}`);
  }
};

export const processWebSocketEvent = (
  tmResponse: TendermintSubscriptionResponse,
  redisClient: MyRedisClientType,
  mnemonicKey: MnemonicKey,
  wallet: Wallet,
  warpSdk: WarpSdk
) => {
  console.log('new tx on warp_controller contract!');
  // console.log('tx log: ' + tmResponse.value.TxResult.result.log)
  // console.log('tx type type: ' + tmResponse.type);
  const actionableEvents = getActionableEvents(tmResponse);
  actionableEvents.forEach((event) =>
    processEvent(event, redisClient, mnemonicKey, wallet, warpSdk).catch((e: any) => {
      if (axios.isAxiosError(e)) {
        console.log(
          // @ts-ignore
          `Code=${e.response!.data['code']} Message=${e.response!.data['message']}`
        );
      }
      throw e;
    })
  );
};
