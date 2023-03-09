import { executeMsg, getWallet, initWarpSdk } from '../../util';
import { warp_controller } from '@terra-money/warp-sdk'

const wallet = getWallet()
const warp_sdk = initWarpSdk();

const createJobMsg = executeMsg<Extract<warp_controller.ExecuteMsg, { create_job: warp_controller.CreateJobMsg }>>(
    wallet.key.accAddress,
    warp_sdk.contractAddress,
    {
        create_job: {
            condition: Condition;
            msgs: string[];
            name: string;
            recurring: boolean;
            requeue_on_evict: boolean;
            reward: Uint128;
            vars: Variable[];
        },
    }
);

warp_sdk.createJob(wallet.key.accAddress, createJobMsg).then(txInfo => {
    console.log(txInfo)
}).catch(err => {
    console.log(err)
})
