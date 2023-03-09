import { getWallet, initWarpSdk } from '../../util';

const wallet = getWallet()
const warp_sdk = initWarpSdk();

warp_sdk.createAccount(wallet.key.accAddress).then(txInfo => {
    console.log(txInfo)
}).catch(err => {
    console.log(err)
})
