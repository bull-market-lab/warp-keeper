import { saveAllPendingJobs } from '../libs/warp_read_helper';
import {
  disconnectRedis,
  disconnectWebSocket,
  getLCD,
  getMnemonicKey,
  getWallet,
  getWebSocketClient,
  getWebSocketQueryWarpController,
  initSentryIfEnabled,
  initWarpSdk,
  printAxiosError,
  sendErrorToSentryIfEnabled,
} from '../libs/util';
import { initRedisClient } from '../libs/redis_helper';
import { processWebSocketEvent } from '../libs/ws_helper';

const main = async () => {
  initSentryIfEnabled();

  const redisClient = await initRedisClient();
  const mnemonicKey = getMnemonicKey();
  const lcd = getLCD();
  const wallet = getWallet(lcd, mnemonicKey);
  const warpSdk = initWarpSdk(lcd, wallet);
  const webSocketClient = getWebSocketClient();

  process.on('SIGINT', async () => {
    console.log('caught interrupt signal');
    await disconnectRedis(redisClient);
    disconnectWebSocket(webSocketClient);
    process.exit(0);
  });

  console.time('saveAllPendingJobs');
  await saveAllPendingJobs(redisClient, warpSdk).catch(async (e) => {
    await disconnectRedis(redisClient);
    disconnectWebSocket(webSocketClient);
    printAxiosError(e);
    sendErrorToSentryIfEnabled(e);
    throw e;
  });
  // running localterra on 2015 mbp, took 966.542ms to save 1047 basic job (simple condition simple msg)
  // pretty good as we don't expect to have many pending job
  console.timeEnd('saveAllPendingJobs');

  // only start web socket after saved all pending jobs, this might lose the jobs created during this period
  // but should avoid some unexpected error i.e. job haven't been saved but triggered ws event
  const queryWarpController = getWebSocketQueryWarpController(warpSdk.contractAddress);
  // TODO: surround this with try catch to close connection
  webSocketClient.subscribeTx(
    queryWarpController,
    async (tmResponse) =>
      await processWebSocketEvent(tmResponse, redisClient, mnemonicKey, wallet, warpSdk).catch(
        (e: any) => {
          printAxiosError(e);
          sendErrorToSentryIfEnabled(e);
          throw e;
        }
      )
  );
  webSocketClient.start();
  console.log('ws connected, start listening to all events relate to warp_controller contract...');

  // WS connection will keep this process running
  // TODO: explore using pm2 to restart it when crash
};

main();
