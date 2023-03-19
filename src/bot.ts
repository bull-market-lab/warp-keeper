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

const main = async () => {
  const redisClient = await initRedisClient();
  console.log('redis connected');
  const mnemonicKey = getMnemonicKey();
  const lcd = getLCD();
  const wallet = getWallet(lcd, mnemonicKey);
  const warpSdk = initWarpSdk(lcd, wallet);
  const webSocketClient = getWebSocketClient();

  process.on('SIGINT', async () => {
    console.log('Caught interrupt signal');
    await redisClient.disconnect();
    webSocketClient.destroy();
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
