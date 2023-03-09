import { LCDClient, MnemonicKey, Wallet } from '@terra-money/terra.js';
import { saveAllJobs, findExecutableJobs } from './util';
import { createClient } from 'redis';
import { WarpSdk, getContractAddress, getNetworkName } from '@terra-money/warp-sdk';
import { CHAIN_ID, LCD_ENDPOINT, MNEMONIC_KEY } from './env';

const run = async () => {
    type redisClientType = ReturnType<typeof createClient>
    const redis_client: redisClientType = createClient();
    redis_client.on('error', (err) => console.log('Redis Client Error', err));
    await redis_client.connect();

    const lcd = new LCDClient({
        URL: LCD_ENDPOINT,
        chainID: CHAIN_ID,
    });
    const mnemonic_key = new MnemonicKey({ mnemonic: MNEMONIC_KEY });
    const wallet = new Wallet(lcd, mnemonic_key);
    const options = {
        lcd,
        wallet,
        contractAddress: getContractAddress(getNetworkName(lcd.config.chainID), 'warp-controller'),
    };

    const warp_sdk = new WarpSdk(wallet, options.contractAddress!);

    let current_height = (await lcd.tendermint.blockInfo()).block.header.height;
    await redis_client.set('initial_height', current_height);

    await saveAllJobs(redis_client, warp_sdk);
    await findExecutableJobs(redis_client, wallet, warp_sdk, mnemonic_key.privateKey);
    await redis_client.disconnect();
};

run();
