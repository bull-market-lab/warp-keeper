import { CreateTxOptions } from '@terra-money/terra.js';
import { warp_controller } from '@terra-money/warp-sdk';
import { getLCD, getMnemonicKey, getWallet, initWarpSdk, printAxiosError } from '../../libs/util';
import { executeMsg } from '../../libs/warp_write_helper';

const mnemonicKey = getMnemonicKey(true);
const lcd = getLCD();
const wallet = getWallet(lcd, mnemonicKey);
const warpSdk = initWarpSdk(lcd, wallet);
const owner = wallet.key.accAddress;

// delete all jobs on first page (50 jobs)
// since all jobs are created by tester this should delete all pending jobs
const run = async () => {
  warpSdk
    .jobs()
    .then((jobs) => {
      const deleteJobMsgs: warp_controller.DeleteJobMsg[] = jobs.map((job) => {
        return { id: job.id };
      });
      const cosmosMsgs = deleteJobMsgs.map((msg) =>
        executeMsg<
          Extract<warp_controller.ExecuteMsg, { delete_job: warp_controller.DeleteJobMsg }>
        >(owner, warpSdk.contractAddress, {
          delete_job: msg,
        })
      );
      // manually delete jobs
      const txOptions: CreateTxOptions = {
        msgs: cosmosMsgs,
      };

      return wallet.createAndSignTx(txOptions);
    })
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
