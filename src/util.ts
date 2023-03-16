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
} from '@terra-money/warp-sdk';
import { TMEvent, TMEventAttribute, TMLog } from 'schema';
import {
  ACTIONABLE_ACTIONS,
  CHAIN_ID_LOCALTERRA,
  EVENT_ATTRIBUTE_KEY_ACTION,
  EVENT_TYPE_WASM,
  WEB_SOCKET_URL,
} from './constant';
import {
  CHAIN_ID,
  LCD_ENDPOINT,
  MNEMONIC_KEY,
  WARP_CONTROLLER_ADDRESS,
} from './env';

export const getLCD = () => {
  return new LCDClient({
    URL: LCD_ENDPOINT,
    chainID: CHAIN_ID,
  });
};

export const getMnemonicKey = () => {
  return new MnemonicKey({ mnemonic: MNEMONIC_KEY });
};

export const getWallet = (lcd: LCDClient, mnemonicKey: MnemonicKey) => {
  return new Wallet(lcd, mnemonicKey);
};

export const initWarpSdk = (lcd: LCDClient, wallet: Wallet) => {
  const contractAddress =
    CHAIN_ID === CHAIN_ID_LOCALTERRA
      ? WARP_CONTROLLER_ADDRESS!
      : getContractAddress(
        getNetworkName(lcd.config.chainID),
        'warp-controller'
      )!;
  return new WarpSdk(wallet, contractAddress);
};

export const getCurrentBlockHeight = async () => {
  const lcd = getLCD();
  return (await lcd.tendermint.blockInfo()).block.header.height;
};

export const getWebSocketClient = () => {
  return new WebSocketClient(WEB_SOCKET_URL);
};

export const getWebSocketQueryWarpController = (
  warpControllerAddress: string
) => {
  return {
    'wasm._contract_address': warpControllerAddress,
    // 'wasm.action': 'create_job',
  };
};

export const getActionableEvents = (
  tmResponse: TendermintSubscriptionResponse
) => {
  // tmResponse is a list of log, each log has a list of events
  // each event has a type and a list of attributes, each attribute is a kv pair
  // we are looking for event type is wasm, that's the event containing contract defined logs
  // and event has attribute where key is action value is create_job, update_job, execute_job, etc
  // see https://github.com/CosmWasm/wasmd/blob/main/EVENTS.md
  const logs: TMLog[] = JSON.parse(tmResponse.value.TxResult.result.log);
  const actionableEvents: TMEvent[] = [];
  logs.forEach((log) => {
    const wasmEvents = log.events.filter(
      (event) => event.type === EVENT_TYPE_WASM
    );
    wasmEvents.forEach((event) => {
      for (const attribute of event.attributes) {
        if (
          attribute.key === EVENT_ATTRIBUTE_KEY_ACTION &&
          attribute.value in ACTIONABLE_ACTIONS
        ) {
          actionableEvents.push(event);
          break;
        }
      }
    });
  });
  return actionableEvents;
};

export const getValueByKeyInAttributes = (
  attributes: TMEventAttribute[],
  k: string
) => {
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
