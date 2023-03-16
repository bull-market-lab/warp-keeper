// @ts-ignore
import { SkipBundleClient } from '@skip-mev/skipjs';
import {
  MnemonicKey,
  Wallet,
} from '@terra-money/terra.js';
import { warp_controller, WarpSdk } from '@terra-money/warp-sdk';
import { getValueByKeyInAttributes } from './util';
import { TMEvent, TMEventAttribute } from 'schema';
import {
  EVENT_ATTRIBUTE_KEY_ACTION,
  // @ts-ignore
  EVENT_ATTRIBUTE_KEY_JOB_CONDITION,
  EVENT_ATTRIBUTE_KEY_JOB_ID,
  EVENT_ATTRIBUTE_VALUE_CREATE_JOB,
  EVENT_ATTRIBUTE_VALUE_DELETE_JOB,
  EVENT_ATTRIBUTE_VALUE_EVICT_JOB,
  EVENT_ATTRIBUTE_VALUE_EXECUTE_JOB,
  EVENT_ATTRIBUTE_VALUE_UPDATE_JOB,
} from 'constant';
import { saveJob } from 'warp_read_helper';
import { executeJob } from 'warp_write_helper';
import { MyRedisClientType } from 'redis_helper';

export const handleJobCreation = async (
  jobId: string,
  // @ts-ignore
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
    // var is not logged, i have to get it from chain, so only get condition from log is useless
    // const varStr = getValueByKeyInAttributes(attributes, )

    // console.log('sleep half block in case rpc has not synced to latest state yet');
    // await new Promise((resolve) => setTimeout(resolve, 1000));

    warpSdk
      .job(jobId)
      .then((job: warp_controller.Job) => {
        warpSdk.condition
          .resolveCond(job.condition, job.vars)
          .then(async (isActive: boolean) => {
            if (isActive) {
              console.log('executing now');
              // sleep half block, setten rpc reports job not found
              // await new Promise((resolve) => setTimeout(resolve, 10000));
              console.log(
                await executeJob(jobId, wallet, mnemonicKey, warpSdk)
              );
              console.log('done executing');
            } else {
              console.log('not executable, save to redis');
              saveJob(job, redisClient);
            }
          })
          .catch((e: Error) => {
            throw e;
          });
      })
      .catch(e => {
        console.log(
          `error getting job, probably due to rpc not updated to latest state: ${e}`,
        );
        throw e;
      });
  }
};

export const handleJobExecution = async () => {
  // TODO
};

export const handleJobUpdate = async () => {
  // TODO
};

export const handleJobDeletion = async () => {
  // TODO
};

export const handleJobEviction = async () => {
  // TODO
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
  let jobAction = getValueByKeyInAttributes(
    attributes,
    EVENT_ATTRIBUTE_KEY_ACTION
  );
  console.log(`jobId: ${jobId}, jobAction: ${jobAction}`);

  switch (jobAction) {
    case EVENT_ATTRIBUTE_VALUE_CREATE_JOB:
      handleJobCreation(
        jobId,
        attributes,
        redisClient,
        mnemonicKey,
        wallet,
        warpSdk
      );
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
