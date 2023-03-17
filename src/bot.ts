import axios from 'axios';
import { saveAllJobs, findExecutableJobs } from './warp_read_helper';
import { getLCD, getMnemonicKey, getWallet, initWarpSdk } from './util';
import { initRedisClient } from './redis_helper';
import { REDIS_CURRENT_ACCOUNT_SEQUENCE } from './constant';

const main = async () => {
  const redisClient = await initRedisClient();
  const mnemonicKey = getMnemonicKey();
  const lcd = getLCD();
  const wallet = getWallet(lcd, mnemonicKey);
  const warpSdk = initWarpSdk(lcd, wallet);

  await redisClient.set(REDIS_CURRENT_ACCOUNT_SEQUENCE, await wallet.sequence())
  await saveAllJobs(redisClient, warpSdk);
  findExecutableJobs(redisClient, wallet, mnemonicKey, warpSdk).catch(
    (e) => {
      redisClient.disconnect();
      if (axios.isAxiosError(e)) {
        // @ts-ignore
        console.log(`Code=${e.response!.data['code']} Message=${e.response!.data['message']}`)
      }
      throw e
    }
  );
};

main();
