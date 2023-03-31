import { findExecutableJobsAndEvictableJobs } from '../libs/warp_read_helper';
import {
  disconnectRedis,
  getLCD,
  getMnemonicKey,
  getWallet,
  initSentryIfEnabled,
  initWarpSdk,
  printAxiosError,
  sendErrorToSentryIfEnabled,
} from '../libs/util';
import { initRedisClient, setEvictionTimeInRedis } from '../libs/redis_helper';

const main = async () => {
  initSentryIfEnabled();
  const redisClient = await initRedisClient();
  const mnemonicKey = getMnemonicKey();
  const lcd = getLCD();
  const wallet = getWallet(lcd, mnemonicKey);
  const warpSdk = initWarpSdk(lcd, wallet);

  process.on('SIGINT', async () => {
    console.log('caught interrupt signal');
    await disconnectRedis(redisClient);
    process.exit(0);
  });

  await setEvictionTimeInRedis(redisClient, warpSdk);

  findExecutableJobsAndEvictableJobs(redisClient, warpSdk).catch(async (e) => {
    await disconnectRedis(redisClient);
    printAxiosError(e);
    sendErrorToSentryIfEnabled(e);
    throw e;
  });
};

main();
