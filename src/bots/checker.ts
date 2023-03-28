import { findExecutableJobs } from '../libs/warp_read_helper';
import {
  disconnectEverything,
  getLCD,
  getMnemonicKey,
  getWallet,
  getWebSocketClient,
  initWarpSdk,
  printAxiosError,
} from '../libs/util';
import { initRedisClient } from '../libs/redis_helper';

import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import { SENTRY_DSN } from '../libs/env';

const main = async () => {
  const redisClient = await initRedisClient();
  const mnemonicKey = getMnemonicKey();
  const lcd = getLCD();
  const wallet = getWallet(lcd, mnemonicKey);
  const warpSdk = initWarpSdk(lcd, wallet);
  const webSocketClient = getWebSocketClient();

  Sentry.init({
    dsn: SENTRY_DSN,

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  });

  process.on('SIGINT', async () => {
    console.log('caught interrupt signal');
    await disconnectEverything(redisClient, webSocketClient);

    // const transaction = Sentry.startTransaction({
    //   op: "test",
    //   name: "My First Test Transaction",
    // });
    Sentry.captureException(new Error('test sentry during exit'));
    // transaction.finish();

    process.exit(0);
  });

  findExecutableJobs(redisClient, warpSdk).catch(async (e) => {
    await disconnectEverything(redisClient, webSocketClient);
    printAxiosError(e);
    throw e;
  });
};

main();
