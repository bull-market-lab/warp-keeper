import { warp_controller } from '@terra-money/warp-sdk';

export const CHAIN_ID_LOCALTERRA = 'localterra';
export const WEB_SOCKET_URL = 'ws://localhost:26657/websocket';
// export const WEB_SOCKET_URL = `wss://rpc.pisco.terra.setten.io/${SETTEN_PROJECT}/websocket?key=${SETTEN_KEY}`

export const EVENT_TYPE_WASM = 'wasm';

export const EVENT_ATTRIBUTE_KEY_ACTION = 'action';
export const EVENT_ATTRIBUTE_KEY_JOB_ID = 'job_id';
export const EVENT_ATTRIBUTE_KEY_JOB_CONDITION = 'job_condition';

export const EVENT_ATTRIBUTE_VALUE_CREATE_JOB = 'create_job';
export const EVENT_ATTRIBUTE_VALUE_UPDATE_JOB = 'update_job';
export const EVENT_ATTRIBUTE_VALUE_EXECUTE_JOB = 'execute_job';
export const EVENT_ATTRIBUTE_VALUE_EVICT_JOB = 'evict_job';
export const EVENT_ATTRIBUTE_VALUE_DELETE_JOB = 'delete_job';

export const ACTIONABLE_ACTIONS = [
  EVENT_ATTRIBUTE_VALUE_CREATE_JOB,
  EVENT_ATTRIBUTE_VALUE_UPDATE_JOB,
  EVENT_ATTRIBUTE_VALUE_EXECUTE_JOB,
  EVENT_ATTRIBUTE_VALUE_EVICT_JOB,
  EVENT_ATTRIBUTE_VALUE_DELETE_JOB,
];

export const QUERY_JOB_LIMIT = 50;
export const QUERY_JOB_STATUS_PENDING: warp_controller.JobStatus = 'Pending';

export const REDIS_CURRENT_ACCOUNT_SEQUENCE = 'current_account_sequence';
export const REDIS_PENDING_JOB_ID_SET = 'pending_job_id_set';
export const REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET =
  'pending_job_id_sorted_by_reward_set';
export const REDIS_PENDING_JOB_ID_TO_CONDITION_MAP =
  'pending_job_id_to_condition_map';
export const REDIS_PENDING_JOB_ID_TO_MESSAGES_MAP =
  'pending_job_id_to_messages_map';
export const REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP =
  'pending_job_id_to_variables_map';

// we need this set so we won't keep checking these low reward jobs
export const REDIS_LOW_REWARD_PENDING_JOB_ID_SET =
  'low_reward_pending_job_id_set';
