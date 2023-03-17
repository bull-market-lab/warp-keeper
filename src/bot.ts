import axios from 'axios';
import { saveAllJobs, findExecutableJobs } from './warp_read_helper';
import {
  getLCD,
  getMnemonicKey,
  getWallet,
  getWebSocketClient,
  getWebSocketQueryWarpController,
  initWarpSdk,
} from './util';
import { initRedisClient } from './redis_helper';
import { REDIS_CURRENT_ACCOUNT_SEQUENCE } from './constant';
import { processWebSocketEvent } from './ws_helper';

const main = async () => {
  const redisClient = await initRedisClient();
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
  await saveAllJobs(redisClient, warpSdk);

  const queryWarpController = getWebSocketQueryWarpController(warpSdk.contractAddress);
  webSocketClient.subscribeTx(queryWarpController, (tmResponse) =>
    processWebSocketEvent(tmResponse, redisClient, mnemonicKey, wallet, warpSdk)
  );
  webSocketClient.start();
  console.log(
    'ws and redis both up, start listening to all events relate to warp_controller contract...'
  );

  findExecutableJobs(redisClient, wallet, mnemonicKey, warpSdk).catch((e) => {
    redisClient.disconnect();
    if (axios.isAxiosError(e)) {
      // @ts-ignore
      console.log(`Code=${e.response!.data['code']} Message=${e.response!.data['message']}`);
    }
    throw e;
  });
};

main();
