export const CHAIN_ID_LOCALTERRA = "localterra"
export const WEB_SOCKET_URL = "ws://localhost:26657/websocket"
// export const WEB_SOCKET_URL = `wss://rpc.pisco.terra.setten.io/${SETTEN_PROJECT}/websocket?key=${SETTEN_KEY}`

export const EVENT_TYPE_WASM = 'wasm'

export const EVENT_ATTRIBUTE_KEY_ACTION = 'action'
export const EVENT_ATTRIBUTE_KEY_JOB_ID = 'job_id'
export const EVENT_ATTRIBUTE_KEY_JOB_CONDITION = 'job_condition'

export const EVENT_ATTRIBUTE_VALUE_CREATE_JOB = 'create_job'
export const EVENT_ATTRIBUTE_VALUE_UPDATE_JOB = 'update_job'
export const EVENT_ATTRIBUTE_VALUE_EXECUTE_JOB = 'execute_job'
export const EVENT_ATTRIBUTE_VALUE_EVICT_JOB = 'evict_job'
export const EVENT_ATTRIBUTE_VALUE_DELETE_JOB = 'delete_job'

export const ACTIONABLE_ACTIONS = [
    EVENT_ATTRIBUTE_VALUE_CREATE_JOB,
    EVENT_ATTRIBUTE_VALUE_UPDATE_JOB,
    EVENT_ATTRIBUTE_VALUE_EXECUTE_JOB,
    EVENT_ATTRIBUTE_VALUE_EVICT_JOB,
    EVENT_ATTRIBUTE_VALUE_DELETE_JOB,
]
