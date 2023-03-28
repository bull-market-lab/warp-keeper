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
import { RedisClientType } from 'redis';
import {
  CHECKER_SLEEP_MILLISECONDS,
  REDIS_CURRENT_ACCOUNT_SEQUENCE,
  REDIS_EXECUTABLE_JOB_ID_SET,
  REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP,
} from './constant';
import { ENABLE_SKIP, SKIP_RPC_ENDPOINT } from './env';
import { removeJobFromRedis } from './redis_helper';
import { parseAccountSequenceFromStringToNumber, printAxiosError } from './util';

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

// dead loop execute every job in executable set
export const executeExecutableJobs = async (
  redisClient: RedisClientType,
  wallet: Wallet,
  mnemonicKey: MnemonicKey,
  warpSdk: WarpSdk
): Promise<void> => {
  let counter = 0;
  while (true) {
    // console.log(`executable jobs count ${await redisClient.sCard(REDIS_EXECUTABLE_JOB_ID_SET)}`);
    const allJobIds: string[] = await redisClient.sMembers(REDIS_EXECUTABLE_JOB_ID_SET);
    for (let i = allJobIds.length - 1; i >= 0; i--) {
      const jobId: string = allJobIds[i]!;
      const jobVariablesStr: string = (await redisClient.hGet(
        REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP,
        jobId
      ))!;
      const jobVariables: warp_controller.Variable[] = JSON.parse(jobVariablesStr).map(
        (jobVariable: string) => JSON.parse(jobVariable)
      );
      console.log(`Find active job ${jobId} from redis, try executing!`);
      const currentSequence = parseAccountSequenceFromStringToNumber(
        (await redisClient.get(REDIS_CURRENT_ACCOUNT_SEQUENCE))!
      );
      // even if job execution failed, we still want to remove it from pending set
      // as we rather miss than trying to execute non executable job to waste money
      await executeJob(jobId, jobVariables, wallet, mnemonicKey, currentSequence, warpSdk).finally(
        async () => {
          await removeJobFromRedis(redisClient, jobId);
          await redisClient.set(REDIS_CURRENT_ACCOUNT_SEQUENCE, currentSequence + 1);
        }
      );
    }

    // console.log(`loop ${counter}, sleep to avoid stack overflow`);
    await new Promise((resolve) => setTimeout(resolve, CHECKER_SLEEP_MILLISECONDS));
    counter++;
  }
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
