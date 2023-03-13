import { getLCD, getMnemonicKey, getWallet, initWarpSdk } from '../../util';

const mnemonicKey = getMnemonicKey();
const lcd = getLCD();
const wallet = getWallet(lcd, mnemonicKey);
const warpSdk = initWarpSdk(lcd, wallet);

warpSdk
  .createAccount(wallet.key.accAddress)
  .then((txInfo) => {
    console.log(txInfo);
  })
  .catch((err) => {
    console.log(err);
  });
