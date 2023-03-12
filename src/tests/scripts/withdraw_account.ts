import { MsgExecuteContract } from '@terra-money/terra.js';
import { warp_controller } from '@terra-money/warp-sdk';
import { getLCD, getMnemonicKey, getWallet, initWarpSdk } from '../../util';

const mnemonicKey = getMnemonicKey()
const lcd = getLCD()
const wallet = getWallet(lcd, mnemonicKey)
const warpSdk = initWarpSdk(lcd, wallet);


const warpAccountAddress = await warpSdk.account(wallet.key.accAddress).then((warp_account: warp_controller.Account) => {
    return warp_account.account
}).catch(err => {
    console.log(err)
    throw err
})

const executeMsg = {
    msgs: [
        {
            bank: {
                send: {
                    amount: [{ denom: "uluna", amount: "100000" }],
                    to_address: wallet.key.accAddress,
                },
            },
        }
    ]
}
const contractSend = new MsgExecuteContract(wallet.key.accAddress, warpAccountAddress, executeMsg)

const tx = await wallet.createAndSignTx({ msgs: [contractSend] });
const result = await wallet.lcd.tx.broadcast(tx);

console.log(result);

// TODO: switch to sdk after merged
// warpSdk.withdrawLunaFromWarpAccount(wallet.key.accAddress, wallet.key.accAddress, 500_000).then(txInfo => {
//     console.log(txInfo)
// }).catch(err => {
//     throw err
// })
