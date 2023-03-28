import { LUNA } from '@terra-money/warp-sdk';
import { getLCD, getMnemonicKey, getWallet, initWarpSdk, printAxiosError } from '../../libs/util';

const mnemonicKey = getMnemonicKey(true);
const lcd = getLCD();
const wallet = getWallet(lcd, mnemonicKey);
const warpSdk = initWarpSdk(lcd, wallet);

const amount = 2_970_000;

const run = async () => {
  warpSdk
    .withdrawFromAccount(wallet.key.accAddress, wallet.key.accAddress, LUNA, amount.toString())
    .then((txInfo) => {
      console.log(txInfo);
    })
    .catch((e) => {
      printAxiosError(e);
      throw e;
    });
};

run();
