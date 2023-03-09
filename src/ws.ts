import { WarpSdk, getContractAddress, getNetworkName, warp_controller } from '@terra-money/warp-sdk';
import { LCDClient, MnemonicKey, Wallet, WebSocketClient } from '@terra-money/terra.js';
import { createClient } from 'redis';
import { executeJob, saveJob } from './util';
import { CHAIN_ID, LCD_ENDPOINT, MNEMONIC_KEY, SETTEN_KEY, SETTEN_PROJECT } from './env';

const main = async () => {
    const redis_client = createClient();
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

    const terraWS = new WebSocketClient(
        `wss://rpc.pisco.terra.setten.io/${SETTEN_PROJECT}/websocket?key=${SETTEN_KEY}`
    );

    const tmQueryCreateJob = {
        'wasm._contract_address': warp_sdk.contractAddress,
        'wasm.action': 'create_job',
    };

    terraWS.subscribeTx(tmQueryCreateJob, (data) => {
        console.log('someone created a job! detected tx! type: ' + data.type);
        const logs = JSON.parse(data.value.TxResult.result.log);
        logs.forEach((log: any) => {
            log.events.forEach((event: any) => {
                if (event.type !== 'wasm') {
                    return;
                }
                event.attributes.forEach(async (attribute: any) => {
                    if (attribute.key !== 'job_id') {
                        return;
                    }
                    const job_id = attribute.value;
                    console.log(`new job_id ${job_id}`);
                    const exist = await redis_client.sIsMember('ids', job_id);
                    if (exist) {
                        console.log('job already in redis');
                    } else {
                        console.log('sleep half block in case rpc has not synced to latest state yet');
                        await new Promise((resolve) => setTimeout(resolve, 1000));

                        let job: warp_controller.Job;
                        try {
                            job = await warp_sdk.job(job_id);
                        } catch (e) {
                            console.log('error getting job, probably due to rpc not updated to latest state', e);
                            return
                        }

                        // console.log('save job to redis');
                        // saveJob(job, redis_client);

                        const isActive = await warp_sdk.condition.resolveCond(job.condition, job.vars);
                        if (isActive) {
                            console.log('executing now');
                            // sleep half block, setten rpc reports job not found
                            // await new Promise((resolve) => setTimeout(resolve, 10000));
                            console.log(await executeJob(wallet, warp_sdk, job.id, mnemonic_key.privateKey));
                            console.log('done executing');
                        } else {
                            console.log('not executable, save to redis');
                            saveJob(job, redis_client);
                        }
                    }
                });
            });
        });
    });

    terraWS.start();
};

main();
