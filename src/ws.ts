// @ts-nocheck
import { WarpSdk, warp_controller } from '@terra-money/warp-sdk';
import { executeJob, saveJob, processEvent } from './warp_helper';
import { getLCD, getMnemonicKey, getWallet, getWebSocketClient, getWebSocketQueryWarpController, initRedisClient, initWarpSdk, MyRedisClientType } from './util';
import { MnemonicKey, TendermintSubscriptionResponse, Wallet } from '@terra-money/terra.js';
import { ACTIONABLE_ACTIONS } from 'constant';

const processWebSocketEvent = (
    tmResponse: TendermintSubscriptionResponse,
    redisClient: MyRedisClientType,
    mnemonicKey: MnemonicKey,
    wallet: Wallet,
    warpSdk: WarpSdk
) => {
    console.log('new tx on warp_controller contract!')
    // console.log('tx log: ' + tmResponse.value.TxResult.result.log)
    // console.log('tx type type: ' + tmResponse.type);
    const actionableEvents = getActionableEvents(tmResponse)
    actionableEvents.forEach(event => processEvent(
        event,
        redisClient,
        mnemonicKey,
        wallet,
        warpSdk
    )
    )
}

const main = async () => {
    const redisClient = await initRedisClient()
    const mnemonicKey = getMnemonicKey()
    const lcd = getLCD()
    const wallet = getWallet(lcd, mnemonicKey)
    const warpSdk = initWarpSdk(lcd, wallet);
    const webSocketClient = getWebSocketClient()
    const queryWarpController = getWebSocketQueryWarpController(warpSdk.contractAddress)
    webSocketClient.subscribeTx(queryWarpController, tmResponse => processWebSocketEvent(
        tmResponse,
        redisClient,
        mnemonicKey,
        wallet,
        warpSdk
    ));
    webSocketClient.start();
    console.log('ws and redis both up, start listening to all events relate to warp_controller contract...')
};

main();
