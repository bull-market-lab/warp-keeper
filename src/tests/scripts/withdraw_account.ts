import { LUNA } from '@terra-money/warp-sdk';
import { getLCD, getMnemonicKey, getWallet, initWarpSdk } from '../../util';

const mnemonicKey = getMnemonicKey();
const lcd = getLCD();
const wallet = getWallet(lcd, mnemonicKey);
const warpSdk = initWarpSdk(lcd, wallet);

const amount = 500_000;

warpSdk
  .withdrawFromAccount(wallet.key.accAddress, wallet.key.accAddress, LUNA, amount.toString())
  .then((txInfo) => {
    console.log(txInfo);
  });
