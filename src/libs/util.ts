import axios from 'axios';
import * as Sentry from '@sentry/node';
import {
  LCDClient,
  MnemonicKey,
  TendermintSubscriptionResponse,
  Wallet,
  WebSocketClient,
} from '@terra-money/terra.js';
import {
  getContractAddress,
  getNetworkName,
  WarpSdk,
  warp_controller,
} from '@terra-money/warp-sdk';
import { TMEvent, TMEventAttribute, TMLog } from './schema';
import {
  ACTIONABLE_ACTIONS,
  AVAILABLE_RECURRING_JOB_CREATION_STATUS,
  CHAIN_ID_LOCALTERRA,
  EVENT_ATTRIBUTE_KET_CREATION_STATUS,
  EVENT_ATTRIBUTE_KEY_ACTION,
  EVENT_ATTRIBUTE_KEY_JOB_ID,
  EVENT_ATTRIBUTE_VALUE_CREATION_STATUS_CREATED,
  EVENT_ATTRIBUTE_VALUE_RECUR_JOB,
  EVENT_TYPE_WASM,
  MIN_REWARD,
  VALID_JOB_STATUS,
} from './constant';
import {
  CHAIN_ID,
  ENABLE_SENTRY,
  LCD_ENDPOINT,
  MNEMONIC_KEY,
  SENTRY_DSN,
  TESTER_MNEMONIC_KEY,
  WARP_CONTROLLER_ADDRESS,
  WEBSOCKET_ENDPOINT,
} from './env';
import { RedisClientType } from 'redis';

export const getLCD = (): LCDClient => {
  return new LCDClient({
    URL: LCD_ENDPOINT,
    chainID: CHAIN_ID,
  });
};

// tester create job and update job, deposit / withdraw
// non tester (keeper) execute job, evict job
export const getMnemonicKey = (isTester = false): MnemonicKey => {
  if (isTester) {
    return new MnemonicKey({ mnemonic: TESTER_MNEMONIC_KEY });
  }
  return new MnemonicKey({ mnemonic: MNEMONIC_KEY });
};

export const getWallet = (lcd: LCDClient, mnemonicKey: MnemonicKey): Wallet => {
  return new Wallet(lcd, mnemonicKey);
};

export const initWarpSdk = (lcd: LCDClient, wallet: Wallet): WarpSdk => {
  const contractAddress =
    CHAIN_ID === CHAIN_ID_LOCALTERRA
      ? WARP_CONTROLLER_ADDRESS!
      : getContractAddress(getNetworkName(lcd.config.chainID), 'warp-controller')!;
  return new WarpSdk(wallet, contractAddress);
};

export const getCurrentBlockHeight = async (lcd: LCDClient): Promise<string> => {
  return (await lcd.tendermint.blockInfo()).block.header.height;
};

export const getCurrentBlockTimeInUnixTimestampInSeconds = async (
  lcd: LCDClient
): Promise<number> => {
  const blockTimeInISODateFormat = (await lcd.tendermint.blockInfo()).block.header.time;
  const dateObj = new Date(blockTimeInISODateFormat);
  return Math.floor(dateObj.getTime() / 1000);
};

export const getWebSocketClient = (): WebSocketClient => {
  return new WebSocketClient(WEBSOCKET_ENDPOINT);
};

export const getWebSocketQueryWarpController = (warpControllerAddress: string) => {
  return {
    // query at tx level
    'wasm._contract_address': warpControllerAddress,
    // query at block level, note this doesn't work as block data only contains tx hash
    // we need to call getTxByHash to get the actual tx data, which is too slow
    // 'CONTAINS': warpControllerAddress
  };
};

export const getActionableEvents = (tmResponse: TendermintSubscriptionResponse): TMEvent[] => {
  // tmResponse is a list of log, each log has a list of events
  // each event has a type and a list of attributes, each attribute is a kv pair
  // we are looking for event type is wasm, that's the event containing contract defined logs
  // and event has attribute where key is action value is create_job, update_job, execute_job, etc
  // see https://github.com/CosmWasm/wasmd/blob/main/EVENTS.md
  const logs: TMLog[] = JSON.parse(tmResponse.value.TxResult.result.log);
  const actionableEvents: TMEvent[] = [];
  logs.forEach((log) => {
    const wasmEvents = log.events.filter((event) => event.type === EVENT_TYPE_WASM);
    wasmEvents.forEach((event) => {
      for (const attribute of event.attributes) {
        if (
          attribute.key === EVENT_ATTRIBUTE_KEY_ACTION &&
          ACTIONABLE_ACTIONS.includes(attribute.value)
        ) {
          // NOTE: execute_job will trigger a reply function, resulting in 2 attribute keys being action
          // key: action, value: execute_job; key: action, value: execute_reply
          // if the executed job is recurring, there will be 3 attribute keys being action
          // key: action, value: execute_job; key: action, value: execute_reply; key: action, value: recur_job
          actionableEvents.push(event);
          break;
        }
      }
    });
  });
  return actionableEvents;
};

// there could be duplicate key in attributes, throw exception if not found
export const getAllValuesByKeyInAttributes = (
  attributes: TMEventAttribute[],
  k: string
): string[] => {
  let val = [];
  for (const attribute of attributes) {
    if (attribute.key === k) {
      val.push(attribute.value);
    }
  }
  if (val.length === 0) {
    throw new Error(
      `please inspect manually, value not found by key: ${k} in attributes: ${attributes}`
    );
  }
  return val;
};

// expect key to be unique, throw exception if not unique or not found
export const getUniqueValueByKeyInAttributes = (
  attributes: TMEventAttribute[],
  k: string
): string => {
  let val = getAllValuesByKeyInAttributes(attributes, k);
  if (val.length !== 1) {
    throw new Error(
      `please inspect manually, value expect to be unique by key: ${k} in attributes: ${attributes}`
    );
  }
  if (val[0] === '') {
    throw new Error(
      `please inspect manually, value not found by key: ${k} in attributes: ${attributes}`
    );
  }
  return val[0];
};

export const parseJobRewardFromStringToNumber = (reward: string): number => {
  // TODO: maybe use bigint in the future
  // but reward is usually low so it shouldn't overflow
  const result = parseInt(reward);
  if (isNaN(result)) {
    throw new Error(`error parsing reward: ${reward} from string to number`);
  }
  return result;
};

export const isRewardSufficient = (reward: number): boolean => {
  // TODO: tweak this threshold
  // if lower than minimum gas then impossible to be profitable
  // limit to at least 0.01 luna
  return reward > MIN_REWARD;
};

export const parseAccountSequenceFromStringToNumber = (sequence: string): number => {
  // TODO: maybe use bigint in the future
  // but sequence is usually low
  const result = parseInt(sequence);
  if (isNaN(result)) {
    throw new Error(`error parsing sequence: ${sequence} from string to number`);
  }
  return result;
};

export const parseTimeFromStringToNumber = (timeStr: string): number => {
  // parse last_update_time or eviction_time (both in seconds) from string to number
  // TODO: maybe use bigint in the future
  const result = parseInt(timeStr);
  if (isNaN(result)) {
    throw new Error(`error parsing time: ${timeStr} from string to number`);
  }
  return result;
};

export const parseJobStatusFromStringToJobStatus = (
  jobStatusStr: string
): warp_controller.JobStatus => {
  const jobStatus = jobStatusStr.substring(1, jobStatusStr.length - 1) as warp_controller.JobStatus;
  if (!VALID_JOB_STATUS.includes(jobStatus)) {
    throw new Error(`unknown job status: ${jobStatus}`);
  }
  return jobStatus;
};

// if is axios error then print the extracted part otherwise print whole error
// most of time it should be cause axios error is the one returned when we call lcd
export const printAxiosError = (e: any) => {
  if (axios.isAxiosError(e)) {
    if (e.response) {
      console.log(e.response.status);
      console.log(e.response.headers);
      if (
        typeof e.response.data === 'object' &&
        e.response.data !== null &&
        'code' in e.response.data &&
        'message' in e.response.data
      ) {
        console.log(`Code=${e.response?.data['code']} Message=${e.response?.data['message']} \n`);
      } else {
        console.log(e.response.data);
      }
    }
  } else {
    console.log(e);
  }
};

export const disconnectRedis = async (redisClient: RedisClientType): Promise<void> => {
  await redisClient.disconnect();
};

export const disconnectWebSocket = (webSocketClient: WebSocketClient): void => {
  webSocketClient.destroy();
};

export const initSentryIfEnabled = (): void => {
  if (ENABLE_SENTRY) {
    Sentry.init({
      dsn: SENTRY_DSN,

      // Set tracesSampleRate to 1.0 to capture 100%
      // of transactions for performance monitoring.
      // We recommend adjusting this value in production
      tracesSampleRate: 1.0,
    });
  }
};

export const sendErrorToSentryIfEnabled = (e: any): void => {
  if (ENABLE_SENTRY) {
    // const transaction = Sentry.startTransaction({
    //   op: "test",
    //   name: "My First Test Transaction",
    // });
    Sentry.captureException(new Error(e));
    // transaction.finish();
  }
};

// return true if executed job is recurring and new job created successfully
// it's possible when recurring job creation failed due to insufficient balance or invalid condition
export const isExecutedJobRecurringAndNewJobCreatedSuccessfully = (
  attributes: TMEventAttribute[]
): boolean => {
  const actions = getAllValuesByKeyInAttributes(attributes, EVENT_ATTRIBUTE_KEY_ACTION);
  // only executing recurring job has recur_job action
  if (!actions.includes(EVENT_ATTRIBUTE_VALUE_RECUR_JOB)) {
    return false;
  }
  const newJobCreationStatus = getUniqueValueByKeyInAttributes(
    attributes,
    EVENT_ATTRIBUTE_KET_CREATION_STATUS
  );
  if (!AVAILABLE_RECURRING_JOB_CREATION_STATUS.includes(newJobCreationStatus)) {
    throw new Error(
      `unknown creation_status for created recurring job in reply: ${newJobCreationStatus}`
    );
  }
  return newJobCreationStatus === EVENT_ATTRIBUTE_VALUE_CREATION_STATUS_CREATED;
};

export const getAllJobIdsInNumberAndSortInAscendingOrder = (
  attributes: TMEventAttribute[]
): number[] => {
  const allJobIds = getAllValuesByKeyInAttributes(attributes, EVENT_ATTRIBUTE_KEY_JOB_ID);
  const allJobIdsNumber = allJobIds.map((jobId) => Number(jobId));
  allJobIdsNumber.sort();
  return allJobIdsNumber;
};

// sometimes there are multiple jobIds in attributes, the smallest one is the processed jobId
// e.g. in execute_job has jobId of executed job and jobId of newly created job if executed job is recurring
export const getProcessedJobId = (attributes: TMEventAttribute[]): string => {
  const allJobIdsNumber = getAllJobIdsInNumberAndSortInAscendingOrder(attributes);
  return allJobIdsNumber[0].toString();
};

// there will be 3 jobId in the attributes, 2 being the old executed jobId, 1 being the newly created jobId
// new jobId should be the biggest one cause jobId is ascending
export const getNewJobIdCreatedFromExecutingRecurringJob = (
  attributes: TMEventAttribute[]
): string => {
  const allJobIdsNumber = getAllJobIdsInNumberAndSortInAscendingOrder(attributes);
  return allJobIdsNumber[allJobIdsNumber.length - 1].toString();
};
