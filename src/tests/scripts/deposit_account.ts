import { MsgSend } from '@terra-money/terra.js';
import { warp_controller } from '@terra-money/warp-sdk';
// import { getContractAddress, getNetworkName, WarpSdk } from '@terra-money/warp-sdk';
import { getLCD, getMnemonicKey, getWallet, initWarpSdk } from '../../util';

const mnemonicKey = getMnemonicKey()
const lcd = getLCD()
const wallet = getWallet(lcd, mnemonicKey)
const warpSdk = initWarpSdk(lcd, wallet);

const warpAccountAddress = await warpSdk.account(wallet.key.accAddress).then((warp_account: warp_controller.Account) => {
    return warp_account.account
}).catch(err => {
    throw err
})

const send = new MsgSend(
    wallet.key.accAddress,
    warpAccountAddress,
    { uluna: 100_000_000 }, // 1 LUNA = 10^6 uluna, deposit 100 LUNA
);

const tx = await wallet.createAndSignTx({ msgs: [send] });
const result = await wallet.lcd.tx.broadcast(tx);
console.log(result);

// TODO: switch to sdk after merged
// warpSdk.depositLunaToWarpAccount(wallet.key.accAddress, warpAccountAddress, 1_000_000).then(txInfo => {
//     console.log(txInfo)
// }).catch(err => {
//     throw err
// })
