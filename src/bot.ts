import { saveAllJobs, findExecutableJobs } from './warp_read_helper';
import {
  getLCD,
  getMnemonicKey,
  getWallet,
  getWebSocketClient,
  getWebSocketQueryWarpController,
  initWarpSdk,
  printAxiosError,
} from './util';
import { initRedisClient } from './redis_helper';
import { REDIS_CURRENT_ACCOUNT_SEQUENCE } from './constant';
import { processWebSocketEvent } from './ws_helper';

import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import { SENTRY_DSN } from './env';

const main = async () => {
  const redisClient = await initRedisClient();
  console.log('redis connected');
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
    console.log('Caught interrupt signal');
    await redisClient.disconnect();
    webSocketClient.destroy();

    // const transaction = Sentry.startTransaction({
    //   op: "test",
    //   name: "My First Test Transaction",
    // });
    Sentry.captureException(new Error('test sentry during exit'));
    // transaction.finish();

    process.exit(0);
  });

  await redisClient.set(REDIS_CURRENT_ACCOUNT_SEQUENCE, await wallet.sequence());
  console.log('start saving pending jobs to redis');
  await saveAllJobs(redisClient, warpSdk);
  console.log('done saving pending jobs to redis');

  const queryWarpController = getWebSocketQueryWarpController(warpSdk.contractAddress);
  webSocketClient.subscribeTx(queryWarpController, (tmResponse) =>
    processWebSocketEvent(tmResponse, redisClient, mnemonicKey, wallet, warpSdk)
  );
  // start ws after saved all pending jobs, this might lose the jobs created during this period
  // but should avoid some unexpected error i.e. job haven't been saved but triggered ws event
  webSocketClient.start();
  console.log('ws connected, start listening to all events relate to warp_controller contract...');

  findExecutableJobs(redisClient, wallet, mnemonicKey, warpSdk).catch((e) => {
    redisClient.disconnect();
    printAxiosError(e);
    throw e;
  });
};

main();
