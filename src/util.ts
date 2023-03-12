// @ts-nocheck
import { SkipBundleClient } from '@skip-mev/skipjs';
import { Coins, CreateTxOptions, LCDClient, MnemonicKey, MsgExecuteContract, MsgRevokeAuthorization, Wallet, WebSocketClient } from '@terra-money/terra.js';
import { getContractAddress, getNetworkName, WarpSdk } from '@terra-money/warp-sdk';
import { createClient } from 'redis';
import { CHAIN_ID_LOCALTERRA, WEB_SOCKET_URL } from './constant';
import { CHAIN_ID, LCD_ENDPOINT, MNEMONIC_KEY, WARP_CONTROLLER_ADDRESS } from './env';

export const getLCD = () => {
    return new LCDClient({
        URL: LCD_ENDPOINT,
        chainID: CHAIN_ID,
    });
}

export const getMnemonicKey = () => {
    return new MnemonicKey({ mnemonic: MNEMONIC_KEY });
}

export const getWallet = (lcd: LCDClient, mnemonicKey: MnemonicKey) => {
    return new Wallet(lcd, mnemonicKey);
}

export const initWarpSdk = (lcd: LCDClient, wallet: Wallet) => {
    const contractAddress = CHAIN_ID === CHAIN_ID_LOCALTERRA ? WARP_CONTROLLER_ADDRESS! : getContractAddress(getNetworkName(lcd.config.chainID), 'warp-controller')!
    return new WarpSdk(wallet, contractAddress);
}

export const getCurrentBlockHeight = async () => {
    const lcd = getLCD()
    return (await lcd.tendermint.blockInfo()).block.header.height;
}

export const getWebSocketClient = () => {
    return new WebSocketClient(WEB_SOCKET_URL);
}

export type MyRedisClientType = ReturnType<typeof createClient>
export const initRedisClient = async (): Promise<MyRedisClientType> => {
    const redisClient = createClient();
    redisClient.on('error', (err) => {
        console.log('Redis Client Error', err)
        throw err
    });
    await redisClient.connect();
    return redisClient
}

export const getWebSocketQueryWarpController = (warpControllerAddress: string) => {
    return {
        'wasm._contract_address': warpControllerAddress,
        // 'wasm.action': 'create_job',
    };
}

export const getActionableEvents = (tmResponse: TendermintSubscriptionResponse): [] => {
    // tmResponse is a list of log, each log has a list of events
    // each event has a type and a list of attributes, each attribute is a kv pair
    // we are looking for event type is wasm, that's the event containing contract defined logs
    // and event has attribute where key is action value is create_job, update_job, execute_job, etc
    // see https://github.com/CosmWasm/wasmd/blob/main/EVENTS.md
    const logs = JSON.parse(tmResponse.value.TxResult.result.log);
    const actionableEvents = []
    logs.forEach(log => {
        const wasmEvents = log.events.filter(event => event.type === 'wasm')
        wasmEvents.forEach(event => {
            if (event.hasOwnProperty('action') && event.action in ACTIONABLE_ACTIONS) {
                actionableEvents.push(event)
            }
        })
    })
    return actionableEvents
}
