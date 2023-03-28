import * as Sentry from '@sentry/node';
import { executeExecutableJobs } from '../libs/warp_write_helper';
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
import { REDIS_CURRENT_ACCOUNT_SEQUENCE } from '../libs/constant';

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

  // save account sequence to redis, going forward we will always set sequence manually
  // so we can send multiple tx in short period of time
  await redisClient.set(REDIS_CURRENT_ACCOUNT_SEQUENCE, await wallet.sequence());

  executeExecutableJobs(redisClient, wallet, mnemonicKey, warpSdk).catch(async (e) => {
    await disconnectRedis(redisClient);
    printAxiosError(e);
    throw e;
  });
};

main();
