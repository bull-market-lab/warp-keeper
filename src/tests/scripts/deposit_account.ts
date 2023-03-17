import { warp_controller, LUNA } from '@terra-money/warp-sdk';
import { getLCD, getMnemonicKey, getWallet, initWarpSdk } from '../../util';

const mnemonicKey = getMnemonicKey();
const lcd = getLCD();
const wallet = getWallet(lcd, mnemonicKey);
const warpSdk = initWarpSdk(lcd, wallet);

const warpAccountAddress = await warpSdk
  .account(wallet.key.accAddress)
  .then((warp_account: warp_controller.Account) => {
    return warp_account.account;
  })

const amount = 1_000_000;

warpSdk
  .depositToAccount(
    wallet.key.accAddress,
    warpAccountAddress,
    LUNA,
    amount.toString()
  )
  .then((txInfo) => {
    console.log(txInfo);
  })
