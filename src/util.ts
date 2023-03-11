// @ts-ignore
import { SkipBundleClient } from '@skip-mev/skipjs';
// @ts-ignore
import { Coins, CreateTxOptions, LCDClient, MnemonicKey, MsgExecuteContract, MsgRevokeAuthorization, Wallet } from '@terra-money/terra.js';
import { getContractAddress, getNetworkName, WarpSdk } from '@terra-money/warp-sdk';
import { CHAIN_ID_LOCALTERRA } from './constant';
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

export const getWallet = () => {
    const lcd = getLCD();
    const mnemonic_key = getMnemonicKey();
    return new Wallet(lcd, mnemonic_key);
}

export const initWarpSdk = () => {
    const lcd = getLCD();
    const wallet = getWallet();
    const localterraWarpControllerAddress = WARP_CONTROLLER_ADDRESS!
    const contractAddress = CHAIN_ID === CHAIN_ID_LOCALTERRA ? localterraWarpControllerAddress : getContractAddress(getNetworkName(lcd.config.chainID), 'warp-controller')
    return new WarpSdk(wallet, contractAddress!);
}
