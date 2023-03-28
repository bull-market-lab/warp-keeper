import { getLCD, getMnemonicKey, getWallet, initWarpSdk, printAxiosError } from '../../libs/util';

const mnemonicKey = getMnemonicKey();
const lcd = getLCD();
const wallet = getWallet(lcd, mnemonicKey);
const warpSdk = initWarpSdk(lcd, wallet);
const owner = wallet.key.accAddress;

const run = async () => {
  warpSdk
    .executeJob(owner, '16')
    .then((txInfo) => console.log(txInfo))
    .catch((e) => {
      printAxiosError(e);
      throw e;
    });
};

run();
