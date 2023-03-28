import { getLCD, getMnemonicKey, getWallet, initWarpSdk, printAxiosError } from '../../libs/util';

const mnemonicKey = getMnemonicKey();
const lcd = getLCD();
const wallet = getWallet(lcd, mnemonicKey);
const warpSdk = initWarpSdk(lcd, wallet);
const owner = wallet.key.accAddress;

const run = async () => {
  warpSdk
    .evictJob(owner, '5')
    .then((txInfo) => {
      console.log(txInfo);
      console.log('evicted job');
    })
    .catch((e) => {
      printAxiosError(e);
      throw e;
    });
};

run();
