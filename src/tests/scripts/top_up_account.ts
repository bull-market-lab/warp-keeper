import { MsgSend } from '@terra-money/terra.js';
import { warp_controller } from '@terra-money/warp-sdk';
import { getWallet, initWarpSdk } from '../../util';

const wallet = getWallet()
const warp_sdk = initWarpSdk();

const warp_account_address = await warp_sdk.account(wallet.key.accAddress).then((warp_account: warp_controller.Account) => {
    return warp_account.account
}).catch(err => {
    console.log(err)
    throw err
})

const send = new MsgSend(
    wallet.key.accAddress,
    warp_account_address,
    { uluna: 1_000_000 }, // 1 LUNA = 10^6 uluna
);

const tx = await wallet.createAndSignTx({ msgs: [send] });
const result = await wallet.lcd.tx.broadcast(tx);

console.log(result);
