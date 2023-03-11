import { warp_controller } from '@terra-money/warp-sdk';
import { WebSocketClient } from '@terra-money/terra.js';
import { createClient } from 'redis';
import { executeJob, saveJob } from './warp_helper';
import { getMnemonicKey, getWallet, initWarpSdk } from './util';

const main = async () => {
    const redisClient = createClient();
    redisClient.on('error', (err) => console.log('Redis Client Error', err));
    await redisClient.connect();

    const mnemonicKey = getMnemonicKey()
    const wallet = getWallet()

    const warpSdk = initWarpSdk();

    const terraWS = new WebSocketClient(
        // `wss://rpc.pisco.terra.setten.io/${SETTEN_PROJECT}/websocket?key=${SETTEN_KEY}`
        'ws://localhost:26657/websocket'
    );

    const tmQueryCreateJob = {
        'wasm._contract_address': warpSdk.contractAddress,
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
                    const exist = await redisClient.sIsMember('ids', job_id);
                    if (exist) {
                        console.log('job already in redis');
                    } else {
                        console.log('sleep half block in case rpc has not synced to latest state yet');
                        await new Promise((resolve) => setTimeout(resolve, 1000));

                        let job: warp_controller.Job;
                        try {
                            job = await warpSdk.job(job_id);
                        } catch (e) {
                            console.log('error getting job, probably due to rpc not updated to latest state', e);
                            return
                        }

                        // console.log('save job to redis');
                        // saveJob(job, redisClient);

                        const isActive = await warpSdk.condition.resolveCond(job.condition, job.vars);
                        if (isActive) {
                            console.log('executing now');
                            // sleep half block, setten rpc reports job not found
                            // await new Promise((resolve) => setTimeout(resolve, 10000));
                            console.log(await executeJob(wallet, warpSdk, job.id, mnemonicKey.privateKey));
                            console.log('done executing');
                        } else {
                            console.log('not executable, save to redis');
                            saveJob(job, redisClient);
                        }
                    }
                });
            });
        });
    });

    terraWS.start();
};

main();
