// @ts-ignore
import { SkipBundleClient } from '@skip-mev/skipjs';
import {
  Coins,
  // @ts-ignore
  CreateTxOptions,
  MnemonicKey,
  MsgExecuteContract,
  Wallet,
} from '@terra-money/terra.js';
import axios from 'axios';
// @ts-ignore
import { warp_controller, WarpSdk } from '@terra-money/warp-sdk';

export function executeMsg<T extends {}>(
  sender: string,
  contract: string,
  msg: T,
  coins?: Coins.Input
) {
  return new MsgExecuteContract(sender, contract, msg, coins);
}

export const executeJob = async (
  jobId: string,
  wallet: Wallet,
  // @ts-ignore
  mnemonicKey: MnemonicKey,
  warpSdk: WarpSdk
): Promise<void> => {
  try {
    // using sdk
    // NOTE this calls sdk.job under the hood to get the job var, avoid doing that as it takes 1 more api call
    // await warpSdk.executeJob(wallet.key.accAddress, jobId).catch(e => {
    //   throw e
    // });

    // manually
    const msg = executeMsg<
      Extract<
        warp_controller.ExecuteMsg,
        { execute_job: warp_controller.ExecuteJobMsg }
      >
    >(wallet.key.accAddress, warpSdk.contractAddress, {
      execute_job: { id: jobId },
    });

    const txOptions: CreateTxOptions = {
      msgs: [msg],
    };
    const tx = await wallet.createAndSignTx(txOptions);

    // without skip
    await wallet.lcd.tx.broadcast(tx);

    // with skip
    // const txString = Buffer.from(tx.toBytes()).toString('base64');
    // const DESIRED_HEIGHT_FOR_BUNDLE = 0;
    // const skipBundleClient = new SkipBundleClient('http://pisco-1-api.skip.money');
    // const bundle = await skipBundleClient.signBundle([txString], mnemonicKey.privateKey);
    // await skipBundleClient.sendBundle(bundle, DESIRED_HEIGHT_FOR_BUNDLE, true);
  } catch (e: any) {
    if (axios.isAxiosError(e)) {
      const msg = JSON.stringify(e.toJSON());
      throw new Error(`${msg}`);
    }
    throw e;
  }
};

export const batchExecuteJob = async () => {
  // TODO
};
