// create immediately executable job and delay job (executable after 5 blocks, about 30s)
import {
  getCurrentBlockHeight,
  getLCD,
  getMnemonicKey,
  getWallet,
  initWarpSdk,
  printAxiosError,
} from '../../util';
import { warp_controller } from '@terra-money/warp-sdk';
import { CreateTxOptions } from '@terra-money/terra.js';
import { executeMsg } from '../../warp_write_helper';

const mnemonicKey = getMnemonicKey(true);
const lcd = getLCD();
const wallet = getWallet(lcd, mnemonicKey);
const warpSdk = initWarpSdk(lcd, wallet);
const owner = wallet.key.accAddress;

const amount1Luna = (1_000_000).toString();

const run = async () => {
  // send money to myself
  const msg = {
    bank: {
      send: {
        amount: [{ denom: 'uluna', amount: amount1Luna }],
        to_address: owner,
      },
    },
  };

  const condition: warp_controller.Condition = {
    expr: {
      block_height: {
        comparator: '0',
        op: 'gt',
      },
    },
  };

  const createJobMsg: warp_controller.CreateJobMsg = {
    condition: condition,
    name: 'test',
    recurring: false,
    requeue_on_evict: false,
    vars: [],
    reward: amount1Luna,
    msgs: [JSON.stringify(msg)],
  };

  const delayBlock = 5;
  const blockHeightDelay = BigInt(await getCurrentBlockHeight()) + BigInt(delayBlock);
  const conditionDelay: warp_controller.Condition = {
    expr: {
      block_height: {
        comparator: blockHeightDelay.toString(),
        op: 'gt',
      },
    },
  };
  const createJobMsgDelay = {
    condition: conditionDelay,
    name: 'test_delay',
    recurring: false,
    requeue_on_evict: false,
    vars: [],
    reward: amount1Luna,
    msgs: [JSON.stringify(msg)],
  };

  // manually construct msg to create multiple job in 1 tx
  const cosmosMsg = executeMsg<
    Extract<warp_controller.ExecuteMsg, { create_job: warp_controller.CreateJobMsg }>
  >(owner, warpSdk.contractAddress, {
    create_job: createJobMsg,
  });

  const cosmosMsgDelayJob = executeMsg<
    Extract<warp_controller.ExecuteMsg, { create_job: warp_controller.CreateJobMsg }>
  >(owner, warpSdk.contractAddress, {
    create_job: createJobMsgDelay,
  });

  // sdk can only create 1 job in 1 tx
  // warpSdk
  //   .createJob(owner, createJobMsg)
  //   .then((txInfo) => {
  //     console.log(txInfo);
  //     console.log('created job');
  //   }).catch(e => {
  //     printAxiosError(e)
  //   })

  // manually create jobs
  const txOptions: CreateTxOptions = {
    // msgs: [cosmosMsg, cosmosMsg, cosmosMsgDelayJob, cosmosMsgDelayJob, cosmosMsgDelayJob],
    // msgs: [cosmosMsg, cosmosMsg, cosmosMsg, cosmosMsg, cosmosMsg, cosmosMsg, cosmosMsg, cosmosMsg, cosmosMsg, cosmosMsg, cosmosMsg, cosmosMsg, cosmosMsg,],
    msgs: [cosmosMsg, cosmosMsg, cosmosMsg, cosmosMsg, cosmosMsg],
  };

  const tx = await wallet
    .createAndSignTx(txOptions)
    .then((tx) => wallet.lcd.tx.broadcast(tx))
    .then((txInfo) => {
      console.log(txInfo);
      console.log('created all jobs');
    })
    .catch((e) => {
      printAxiosError(e);
      // throw e
    });
};

run();
