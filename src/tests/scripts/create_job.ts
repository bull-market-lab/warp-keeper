import {
  // @ts-ignore
  getCurrentBlockHeight,
  getLCD,
  getMnemonicKey,
  getWallet,
  initWarpSdk,
} from '../../util';
import { warp_controller } from '@terra-money/warp-sdk';
// import { executeMsg } from '../../warp_helper';

const mnemonicKey = getMnemonicKey();
const lcd = getLCD();
const wallet = getWallet(lcd, mnemonicKey);
const warpSdk = initWarpSdk(lcd, wallet);
const owner = wallet.key.accAddress;

const condition: warp_controller.Condition = {
  expr: {
    block_height: {
      comparator: '0',
      op: 'gt',
    },
  },
};

const msg = {
  bank: {
    send: {
      amount: [{ denom: 'uluna', amount: '100000' }],
      to_address: owner,
    },
  },
};

// cannot use this because create_job takes a modified version of warp_controller.createJobMsg
// const createJobMsg = executeMsg<Extract<warp_controller.ExecuteMsg, { create_job: warp_controller.CreateJobMsg }>>(
//     wallet.key.accAddress,
//     warpSdk.contractAddress,
//     {
//         create_job: {
//             condition: condition,
//             msgs: [JSON.stringify(msg)],
//             name: 'test',
//             recurring: false,
//             requeue_on_evict: false,
//             reward: '1000000', // 1 LUNA
//             vars: [],
//         },
//     }
// );

// const createJobMsg: warp_controller.CreateJobMsg = {
//     msgs: [JSON.stringify(msg)],
//     reward: '1000000',
//     condition: condition,
//     vars: [],
//     name: 'test',
//     recurring: false,
//     requeue_on_evict: false
// };

// TODO: this is of type CreateJobMsg, update it after CreateJobMsg is exported from warp-sdk
const createJobMsg = {
  condition: condition,
  name: 'test',
  recurring: false,
  requeue_on_evict: false,
  vars: [],
  reward: '1000000', // 1 LUNA
  msgs: [msg],
};

// const delayBlock = 2;
// const blockHeightDelay =
//   BigInt(await getCurrentBlockHeight()) + BigInt(delayBlock);
// const conditionDelay: warp_controller.Condition = {
//   expr: {
//     block_height: {
//       comparator: blockHeightDelay.toString(),
//       op: 'gt',
//     },
//   },
// };
// const createJobMsgDelay = {
//   condition: conditionDelay,
//   name: 'test_delay',
//   recurring: false,
//   requeue_on_evict: false,
//   vars: [],
//   reward: '1000000', // 1 LUNA
//   msgs: [msg],
// };

warpSdk
  .createJob(owner, createJobMsg)
  .then((txInfo) => {
    console.log(txInfo);
    console.log('created job');
  })
  .then((_) => {
    // warpSdk.createJob(owner, createJobMsgDelay).then(txInfo => {
    //     // console.log(txInfo)
    //     console.log('created delay job')
    // }).catch(err => {
    //     throw err
    // })
  });

// warpSdk.createJob(owner, createJobMsgDelay).then(txInfo => {
//     // console.log(txInfo)
//     console.log('created delay job')
// }).catch(err => {
//     throw err
// })
