import { saveAllJobs, findExecutableJobs } from './warp_helper';
import { getLCD, getMnemonicKey, getWallet, initRedisClient, initWarpSdk } from './util';

const main = async () => {
    const redisClient = await initRedisClient()
    const mnemonicKey = getMnemonicKey()
    const lcd = getLCD()
    const wallet = getWallet(lcd, mnemonicKey)
    const warpSdk = initWarpSdk(lcd, wallet);

    // let current_height = (await lcd.tendermint.blockInfo()).block.header.height;
    // await redisClient.set('initial_height', current_height);

    await saveAllJobs(redisClient, warpSdk);
    await findExecutableJobs(redisClient, wallet, warpSdk, mnemonicKey.privateKey);
    await redisClient.disconnect();
};

main();
