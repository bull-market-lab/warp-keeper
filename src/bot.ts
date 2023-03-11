import { saveAllJobs, findExecutableJobs } from './warp_helper';
import { createClient } from 'redis';
import { getMnemonicKey, getWallet, initWarpSdk } from './util';

const run = async () => {
    type redisClientType = ReturnType<typeof createClient>
    const redisClient: redisClientType = createClient();
    redisClient.on('error', (err) => console.log('Redis Client Error', err));
    await redisClient.connect();

    const wallet = getWallet()
    const warpSdk = initWarpSdk();
    const mnemonic_key = getMnemonicKey();

    // let current_height = (await lcd.tendermint.blockInfo()).block.header.height;
    // await redisClient.set('initial_height', current_height);

    await saveAllJobs(redisClient, warpSdk);
    await findExecutableJobs(redisClient, wallet, warpSdk, mnemonic_key.privateKey);
    await redisClient.disconnect();
};

run();
