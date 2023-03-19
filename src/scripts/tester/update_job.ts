import { warp_controller } from '@terra-money/warp-sdk';
import { getLCD, getMnemonicKey, getWallet, initWarpSdk, printAxiosError } from '../../util';

const mnemonicKey = getMnemonicKey(true);
const lcd = getLCD();
const wallet = getWallet(lcd, mnemonicKey);
const warpSdk = initWarpSdk(lcd, wallet);
const owner = wallet.key.accAddress;

const updateMsg: warp_controller.UpdateJobMsg = {
  // min reward is 20 uluna (0.0002) luna to prevent job evicted
  // still lower than 0.01 luna eviction fee
  // 20 because creation fee is 5%, creation fee > 0 will satisfy the contract
  added_reward: '19',
  id: '5',
};

warpSdk
  .updateJob(owner, updateMsg)
  .then((txInfo) => {
    console.log(txInfo);
    console.log('updated job with more reward');
  })
  .catch((e) => {
    printAxiosError(e);
    throw e;
  });
