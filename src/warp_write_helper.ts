import { SkipBundleClient } from '@skip-mev/skipjs';
import {
  Coins,
  CreateTxOptions,
  MnemonicKey,
  MsgExecuteContract,
  Tx,
  Wallet,
} from '@terra-money/terra.js';
import { warp_controller, WarpSdk, base64encode } from '@terra-money/warp-sdk';
import { ENABLE_SKIP, SKIP_RPC_ENDPOINT } from './env';

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
  // @ts-ignore
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
  // TODO: add back after sdk exports resolveExternalInputs
  // const externalInputs = await resolveExternalInputs(jobVariables);
  const executeJobMsg: warp_controller.ExecuteJobMsg = {
    id: jobId,
    // external_inputs: externalInputs
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
  const tx = await wallet.createAndSignTx(txOptions);
  await broadcastTx(wallet, mnemonicKey, tx);
};

export const batchExecuteJob = async () => {
  // TODO:
};

const broadcastTx = async (wallet: Wallet, mnemonicKey: MnemonicKey, tx: Tx): Promise<void> => {
  if (!ENABLE_SKIP) {
    wallet.lcd.tx.broadcast(tx);
    return;
  }

  // TODO: test if base64encode works, this cannot be tested in localterra, use polkachu rpc
  const txString = base64encode(tx);
  // const txString = Buffer.from(tx.toBytes()).toString('base64');
  const DESIRED_HEIGHT_FOR_BUNDLE = 0;
  const skipBundleClient = new SkipBundleClient(SKIP_RPC_ENDPOINT!);
  skipBundleClient.signBundle([txString], mnemonicKey.privateKey).then((bundle) => {
    skipBundleClient.sendBundle(bundle, DESIRED_HEIGHT_FOR_BUNDLE, true);
  });
};
