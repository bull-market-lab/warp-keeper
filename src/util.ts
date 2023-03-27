import axios from 'axios';
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
  CHAIN_ID_LOCALTERRA,
  EVENT_ATTRIBUTE_KEY_ACTION,
  EVENT_TYPE_WASM,
  VALID_JOB_STATUS,
} from './constant';
import {
  CHAIN_ID,
  LCD_ENDPOINT,
  MNEMONIC_KEY,
  TESTER_MNEMONIC_KEY,
  WARP_CONTROLLER_ADDRESS,
  WEB_SOCKET_ENDPOINT,
} from './env';
import { RedisClientType } from 'redis';

export const getLCD = () => {
  return new LCDClient({
    URL: LCD_ENDPOINT,
    chainID: CHAIN_ID,
  });
};

// tester create job and update job, deposit / withdraw
// non tester (keeper) execute job, evict job
export const getMnemonicKey = (isTester = false) => {
  if (isTester) {
    return new MnemonicKey({ mnemonic: TESTER_MNEMONIC_KEY });
  }
  return new MnemonicKey({ mnemonic: MNEMONIC_KEY });
};

export const getWallet = (lcd: LCDClient, mnemonicKey: MnemonicKey) => {
  return new Wallet(lcd, mnemonicKey);
};

export const initWarpSdk = (lcd: LCDClient, wallet: Wallet) => {
  const contractAddress =
    CHAIN_ID === CHAIN_ID_LOCALTERRA
      ? WARP_CONTROLLER_ADDRESS!
      : getContractAddress(getNetworkName(lcd.config.chainID), 'warp-controller')!;
  return new WarpSdk(wallet, contractAddress);
};

export const getCurrentBlockHeight = async () => {
  const lcd = getLCD();
  return (await lcd.tendermint.blockInfo()).block.header.height;
};

export const getWebSocketClient = () => {
  return new WebSocketClient(WEB_SOCKET_ENDPOINT);
};

export const getWebSocketQueryWarpController = (warpControllerAddress: string) => {
  return {
    'wasm._contract_address': warpControllerAddress,
    // 'wasm.action': 'create_job',
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
          actionableEvents.push(event);
          break;
        }
      }
    });
  });
  return actionableEvents;
};

export const getValueByKeyInAttributes = (attributes: TMEventAttribute[], k: string): string => {
  let val = '';
  for (const attribute of attributes) {
    if (attribute.key === k) {
      val = attribute.value;
      break;
    }
  }
  if (val === '') {
    throw new Error(
      `please inspect manually, value not found by key: ${k} in attributes: ${attributes}`
    );
  }
  return val;
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
  // TODO: set this in env, this should be an estimation on minimum gas
  // if lower than minimum gas then impossible to be profitable
  // limit to 0.001 luna
  return reward / 1000 > 0;
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

export const parseJobStatusFromStringToJobStatus = (
  jobStatusStr: string
): warp_controller.JobStatus => {
  const jobStatus = jobStatusStr as warp_controller.JobStatus;
  if (!VALID_JOB_STATUS.includes(jobStatus)) {
    throw new Error(`unknown job status: ${jobStatus}`);
  }
  return jobStatus;
};

// if is axios error then print the extracted part otherwise print whole error
// most of time it should be cause axios error is the one returned when we call lcd
export const printAxiosError = (e: any) => {
  if (axios.isAxiosError(e)) {
    console.log(
      // @ts-ignore
      `Code=${e.response!.data['code']} Message=${e.response!.data['message']} \n`
    );
  } else {
    console.log(e);
  }
};

export const disconnectEverything = async (
  redisClient: RedisClientType,
  webSocketClient: WebSocketClient
): Promise<void> => {
  await redisClient.disconnect();
  webSocketClient.destroy();
};
