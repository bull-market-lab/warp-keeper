export const CHAIN_ID_LOCALTERRA = "localterra"
export const WEB_SOCKET_URL = "ws://localhost:26657/websocket"
// export const WEB_SOCKET_URL = `wss://rpc.pisco.terra.setten.io/${SETTEN_PROJECT}/websocket?key=${SETTEN_KEY}`

export const ACTION_CREATE_JOB = 'create_job'
export const ACTION_UPDATE_JOB = 'update_job'
export const ACTION_EXECUTE_JOB = 'execute_job'
export const ACTION_EVICT_JOB = 'evict_job'
export const ACTION_DELETE_JOB = 'delete_job'
export const ACTIONABLE_ACTIONS = [
    ACTION_CREATE_JOB,
    ACTION_UPDATE_JOB,
    ACTION_EXECUTE_JOB,
    ACTION_EVICT_JOB,
    ACTION_DELETE_JOB,
]
