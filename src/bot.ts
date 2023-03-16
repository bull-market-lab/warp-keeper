import { saveAllJobs, findExecutableJobs } from './warp_read_helper';
import { getLCD, getMnemonicKey, getWallet, initWarpSdk } from './util';
import { initRedisClient } from './redis_helper';

const main = async () => {
  const redisClient = await initRedisClient();
  const mnemonicKey = getMnemonicKey();
  const lcd = getLCD();
  const wallet = getWallet(lcd, mnemonicKey);
  const warpSdk = initWarpSdk(lcd, wallet);

  await saveAllJobs(redisClient, warpSdk);
  await findExecutableJobs(redisClient, wallet, mnemonicKey, warpSdk).catch(
    (e) => {
      console.log(
        `unknown_error_while_trying_to_find_pending_jobs_to_execute:${e}`
      );
      redisClient.disconnect();
    }
  );
};

main();
