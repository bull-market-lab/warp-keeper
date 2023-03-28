import * as Sentry from '@sentry/node';
import { findExecutableJobs } from '../libs/warp_read_helper';
import {
  disconnectRedis,
  getLCD,
  getMnemonicKey,
  getWallet,
  initSentry,
  initWarpSdk,
  printAxiosError,
} from '../libs/util';
import { initRedisClient } from '../libs/redis_helper';

const main = async () => {
  initSentry();
  const redisClient = await initRedisClient();
  const mnemonicKey = getMnemonicKey();
  const lcd = getLCD();
  const wallet = getWallet(lcd, mnemonicKey);
  const warpSdk = initWarpSdk(lcd, wallet);

  process.on('SIGINT', async () => {
    console.log('caught interrupt signal');
    await disconnectRedis(redisClient);

    // const transaction = Sentry.startTransaction({
    //   op: "test",
    //   name: "My First Test Transaction",
    // });
    Sentry.captureException(new Error('test sentry during exit'));
    // transaction.finish();

    process.exit(0);
  });

  findExecutableJobs(redisClient, warpSdk).catch(async (e) => {
    await disconnectRedis(redisClient);
    printAxiosError(e);
    throw e;
  });
};

main();
