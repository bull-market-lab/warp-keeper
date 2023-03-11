import { MsgSend } from '@terra-money/terra.js';
import { warp_controller } from '@terra-money/warp-sdk';
// import { getContractAddress, getNetworkName, WarpSdk } from '@terra-money/warp-sdk';
import { getWallet, initWarpSdk } from '../../util';

const wallet = getWallet()
const warpSdk = initWarpSdk();

const warpAccountAddress = await warpSdk.account(wallet.key.accAddress).then((warp_account: warp_controller.Account) => {
    return warp_account.account
}).catch(err => {
    throw err
})

const send = new MsgSend(
    wallet.key.accAddress,
    warpAccountAddress,
    { uluna: 1_000_000 }, // 1 LUNA = 10^6 uluna
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
