import { SkipBundleClient } from '@skip-mev/skipjs';
import {
  Coins,
  CreateTxOptions,
  MnemonicKey,
  MsgExecuteContract,
  Tx,
  Wallet,
} from '@terra-money/terra.js';
import { warp_controller, WarpSdk, resolveExternalInputs } from '@terra-money/warp-sdk';
import { ENABLE_SKIP, SKIP_RPC_ENDPOINT } from './env';
import { printAxiosError } from './util';

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
  jobVariables: warp_controller.Variable[],
  wallet: Wallet,
  mnemonicKey: MnemonicKey,
  sequence: number,
  warpSdk: WarpSdk
): Promise<void> => {
  // using sdk
  // NOTE this calls sdk.job under the hood to get the job var
  // we should avoid doing that as it takes 1 more api call
  // await warpSdk.executeJob(wallet.key.accAddress, jobId)

  // manually
  const externalInputs = await resolveExternalInputs(jobVariables);
  const executeJobMsg: warp_controller.ExecuteJobMsg = {
    id: jobId,
    external_inputs: externalInputs,
  };
  const msg = executeMsg<
    Extract<warp_controller.ExecuteMsg, { execute_job: warp_controller.ExecuteJobMsg }>
  >(wallet.key.accAddress, warpSdk.contractAddress, {
    execute_job: executeJobMsg,
  });

  const txOptions: CreateTxOptions & {
    sequence?: number;
  } = {
    msgs: [msg],
    sequence,
  };
  await wallet
    .createAndSignTx(txOptions)
    .then((tx) => broadcastTx(wallet, mnemonicKey, tx))
    .then((_) => console.log(`done executing job ${jobId}`))
    .catch((e) => {
      printAxiosError(e);
      throw e;
    });
};

// maybe this is a bad idea, we only want to put 1 execute per tx to avoid 1 failure ruined eveyrthing
export const batchExecuteJob = async () => {
  // TODO:
};

const broadcastTx = async (wallet: Wallet, mnemonicKey: MnemonicKey, tx: Tx): Promise<void> => {
  if (!ENABLE_SKIP) {
    wallet.lcd.tx.broadcast(tx);
    return;
  }

  const txString = Buffer.from(tx.toBytes()).toString('base64');
  const DESIRED_HEIGHT_FOR_BUNDLE = 0;
  const skipBundleClient = new SkipBundleClient(SKIP_RPC_ENDPOINT!);
  skipBundleClient.signBundle([txString], mnemonicKey.privateKey).then((bundle) => {
    skipBundleClient.sendBundle(bundle, DESIRED_HEIGHT_FOR_BUNDLE, true);
  });
};
