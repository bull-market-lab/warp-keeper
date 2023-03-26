import { getLCD, getMnemonicKey, getWallet, initWarpSdk, printAxiosError } from '../../util';

const mnemonicKey = getMnemonicKey(true);
const lcd = getLCD();
const wallet = getWallet(lcd, mnemonicKey);
const warpSdk = initWarpSdk(lcd, wallet);

const run = async () => {
  warpSdk
    .createAccount(wallet.key.accAddress)
    .then((txInfo) => {
      console.log(txInfo);
    })
    .catch((e) => {
      printAxiosError(e);
      throw e;
    });
};
run();
