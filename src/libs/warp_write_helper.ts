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
  EXECUTOR_SLEEP_MILLISECONDS,
  REDIS_EVICTABLE_JOB_ID_SET,
  REDIS_EXECUTABLE_JOB_ID_SET,
  REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP,
} from './constant';
import { ENABLE_SKIP, SKIP_RPC_ENDPOINT } from './env';
import {
  getJobVariablesFromRedis,
  removeJobFromRedis,
  getAccountSequenceFromRedis,
  incrementAccountSequenceInRedis,
  removeJobFromEvictableSetInRedis,
} from './redis_helper';
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
  // also we cannot set sequence manually using SDK
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
    .then((_) => console.log(`jobId ${jobId} done executed`))
    .catch((e) => {
      printAxiosError(e);
      throw e;
    });
};

export const evictJob = async (
  jobId: string,
  wallet: Wallet,
  mnemonicKey: MnemonicKey,
  sequence: number,
  warpSdk: WarpSdk
): Promise<void> => {
  // using sdk
  // NOTE this calls sdk.job under the hood to get the job var
  // we should avoid doing that as it takes 1 more api call
  // also we cannot set sequence manually using SDK
  // await warpSdk.evictJob(wallet.key.accAddress, jobId)

  // manually
  const evictJobMsg: warp_controller.EvictJobMsg = {
    id: jobId,
  };
  const msg = executeMsg<
    Extract<warp_controller.ExecuteMsg, { evict_job: warp_controller.EvictJobMsg }>
  >(wallet.key.accAddress, warpSdk.contractAddress, {
    evict_job: evictJobMsg,
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
    .then((_) => console.log(`jobId ${jobId} done evicted`))
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

// dead loop execute / evict every job in executable set / evictable set
// put eviction and execution has 2 reasons
// 1. we don't expect to have a lot of jobs to be executed / evicted in short period of time
// 2. so we can keep only 1 bot with wallet (i.e. executor bot)
// keeping them separated needs to have 2 wallets as we manage account sequence manually
export const executeAndEvictJob = async (
  redisClient: RedisClientType,
  wallet: Wallet,
  mnemonicKey: MnemonicKey,
  warpSdk: WarpSdk
): Promise<void> => {
  let counter = 0;
  while (true) {
    // console.log(`executable jobs count ${await redisClient.sCard(REDIS_EXECUTABLE_JOB_ID_SET)}`);
    const allExecutableJobIds: string[] = await redisClient.sMembers(REDIS_EXECUTABLE_JOB_ID_SET);
    for (let i = allExecutableJobIds.length - 1; i >= 0; i--) {
      const jobId: string = allExecutableJobIds[i]!;
      console.log(`jobId ${jobId} found executable from redis, try executing it`);

      const jobVariables = await getJobVariablesFromRedis(redisClient, jobId);
      const currentAccountSequence = await getAccountSequenceFromRedis(redisClient);
      // even if job execution failed, we still want to remove it from executable set
      // as we rather miss than trying to execute non executable job to waste money
      await executeJob(
        jobId,
        jobVariables,
        wallet,
        mnemonicKey,
        currentAccountSequence,
        warpSdk
      ).finally(async () => {
        await removeJobFromRedis(redisClient, jobId);
        // TODO: only increment sequence when tx fail or succeed, if tx is invalid do nothing
        await incrementAccountSequenceInRedis(redisClient, currentAccountSequence);
      });
    }

    const allEvictableJobIds: string[] = await redisClient.sMembers(REDIS_EVICTABLE_JOB_ID_SET);
    for (let i = allEvictableJobIds.length - 1; i >= 0; i--) {
      const jobId: string = allEvictableJobIds[i]!;
      console.log(`jobId ${jobId} found evictable from redis, try evicting it`);

      const currentAccountSequence = await getAccountSequenceFromRedis(redisClient);
      // even if job eviction failed, we still want to remove it from evictable set
      // as we rather miss than trying to evict non evictable job to waste money
      await evictJob(jobId, wallet, mnemonicKey, currentAccountSequence, warpSdk).finally(
        async () => {
          await removeJobFromEvictableSetInRedis(redisClient, jobId);
          // TODO: only increment sequence when tx fail or succeed, if tx is invalid do nothing
          await incrementAccountSequenceInRedis(redisClient, currentAccountSequence);
        }
      );
    }

    // console.log(`loop ${counter}, sleep to avoid stack overflow`);
    await new Promise((resolve) => setTimeout(resolve, EXECUTOR_SLEEP_MILLISECONDS));
    counter++;
  }
};
