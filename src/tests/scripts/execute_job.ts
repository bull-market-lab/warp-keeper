import {
  // @ts-ignore
  getCurrentBlockHeight,
  getLCD,
  getMnemonicKey,
  getWallet,
  initWarpSdk,
} from '../../util';
// import { executeMsg } from '../../warp_helper';

const mnemonicKey = getMnemonicKey();
const lcd = getLCD();
const wallet = getWallet(lcd, mnemonicKey);
const warpSdk = initWarpSdk(lcd, wallet);
const owner = wallet.key.accAddress;

warpSdk.executeJob(owner, '16');
