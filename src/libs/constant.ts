import { warp_controller } from '@terra-money/warp-sdk';

export const CHAIN_ID_LOCALTERRA = 'localterra';

export const EVENT_TYPE_WASM = 'wasm';

export const EVENT_ATTRIBUTE_KEY_ACTION = 'action';
export const EVENT_ATTRIBUTE_KEY_JOB_ID = 'job_id';
export const EVENT_ATTRIBUTE_KEY_JOB_CONDITION = 'job_condition';
export const EVENT_ATTRIBUTE_KEY_JOB_REWARD = 'job_reward';
export const EVENT_ATTRIBUTE_KEY_JOB_STATUS = 'job_status';
export const EVENT_ATTRIBUTE_KEY_JOB_LAST_UPDATED_TIME = 'job_last_updated_time';

export const EVENT_ATTRIBUTE_VALUE_CREATE_JOB = 'create_job';
export const EVENT_ATTRIBUTE_VALUE_UPDATE_JOB = 'update_job';
export const EVENT_ATTRIBUTE_VALUE_EXECUTE_JOB = 'execute_job';
export const EVENT_ATTRIBUTE_VALUE_EVICT_JOB = 'evict_job';
export const EVENT_ATTRIBUTE_VALUE_DELETE_JOB = 'delete_job';
export const EVENT_ATTRIBUTE_VALUE_EXECUTE_REPLY = 'execute_reply';
export const EVENT_ATTRIBUTE_VALUE_RECUR_JOB = 'recur_job';

export const EVENT_ATTRIBUTE_KET_CREATION_STATUS = 'creation_status';
export const EVENT_ATTRIBUTE_VALUE_CREATION_STATUS_CREATED = 'created';
export const EVENT_ATTRIBUTE_VALUE_CREATION_STATUS_FAILED_INSUFFICIENT_FEE =
  'failed_insufficient_fee';
export const EVENT_ATTRIBUTE_VALUE_CREATION_STATUS_FAILED_INVALID_JOB_STATUS =
  'failed_invalid_job_status';

export const ACTIONABLE_ACTIONS = [
  EVENT_ATTRIBUTE_VALUE_CREATE_JOB,
  EVENT_ATTRIBUTE_VALUE_UPDATE_JOB,
  EVENT_ATTRIBUTE_VALUE_EXECUTE_JOB,
  EVENT_ATTRIBUTE_VALUE_EVICT_JOB,
  EVENT_ATTRIBUTE_VALUE_DELETE_JOB,
];

export const AVAILABLE_RECURRING_JOB_CREATION_STATUS = [
  EVENT_ATTRIBUTE_VALUE_CREATION_STATUS_CREATED,
  EVENT_ATTRIBUTE_VALUE_CREATION_STATUS_FAILED_INSUFFICIENT_FEE,
  EVENT_ATTRIBUTE_VALUE_CREATION_STATUS_FAILED_INVALID_JOB_STATUS,
];

export const QUERY_JOB_LIMIT = 50;
export const JOB_STATUS_PENDING: warp_controller.JobStatus = 'Pending';
export const JOB_STATUS_EXECUTED: warp_controller.JobStatus = 'Executed';
export const JOB_STATUS_FAILED: warp_controller.JobStatus = 'Failed';
export const JOB_STATUS_CANCELLED: warp_controller.JobStatus = 'Cancelled';
export const JOB_STATUS_EVICTED: warp_controller.JobStatus = 'Evicted';
export const VALID_JOB_STATUS: warp_controller.JobStatus[] = [
  JOB_STATUS_PENDING,
  JOB_STATUS_EXECUTED,
  JOB_STATUS_FAILED,
  JOB_STATUS_CANCELLED,
  JOB_STATUS_EVICTED,
];

export const REDIS_CURRENT_ACCOUNT_SEQUENCE = 'current_account_sequence';

export const REDIS_PENDING_JOB_ID_SET = 'pending_job_id_set';
export const REDIS_PENDING_JOB_ID_SORTED_BY_REWARD_SET = 'pending_job_id_sorted_by_reward_set';

export const REDIS_PENDING_JOB_ID_TO_REWARD_MAP = 'pending_job_id_to_reward_map';

export const REDIS_PENDING_JOB_ID_TO_CONDITION_MAP = 'pending_job_id_to_condition_map';
// msgs are not used, we only need id and condition and vars determine if active
// export const REDIS_PENDING_JOB_ID_TO_MESSAGES_MAP = 'pending_job_id_to_messages_map';
export const REDIS_PENDING_JOB_ID_TO_VARIABLES_MAP = 'pending_job_id_to_variables_map';
export const REDIS_PENDING_JOB_ID_TO_LAST_UPDATE_TIME_MAP =
  'pending_job_id_to_last_update_time_map';

export const REDIS_EXECUTABLE_JOB_ID_SET = 'executable_job_id_set';

export const REDIS_EVICTABLE_JOB_ID_SET = 'evictable_job_id_set';

// this is set in controller contract's config during initialization
// currently it's 1 day or 86400 seconds
// if current time - job's last update time > eviction time then job can be evicted
// eviction event handler will determine if we want to remove the job based on updated job status
// all time are in UTC timezone
export const REDIS_EVICTION_TIME = 'eviction_time_in_second';

export const MONITOR_SLEEP_MILLISECONDS = 100;
export const EXECUTOR_SLEEP_MILLISECONDS = 100;
