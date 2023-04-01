# list of TODOs

## current status
MVP should be considered as completed, optimization and corner cases still need to be taken care of.

## next steps
- before executor actually executing a job, check condition again to make sure?
    - what's the cost of trying to execute an already executed job, need to test in testnet
- race condition?
    - create job and delete job in same tx
        - in order to delete a job we need to know the jobId, jobId is unknown until job is created, but we can guess the jobId so it's possible to create then delete in same tx, but why would anyone do that just to waste money?
            - however this might crash the bot, delete job event processed first, create job event handled later, resulting in executor trying to execute an already deleted job
    - create job in tx1 and delete job in tx2
- go over each redis operation, when to delete everything vs only id
- fix eslint suggestions
- finish all TODOs in code

## improvements
### monitor
- [must do] able to detect contract migration (that leads to schema change / api breaking change )
- integrate grafana metrics
- a;ert when no heartbeat

### performance
- add more to cache (condition, template, etc)
    - depends on contract add variables to log
- divide jobs into different queue by their type
    timestamp, block height
    query
- look into each function in sdk and calculate number of api call per operation
- [must do] check if redis operation is thread safe
    - i.e. we want to have multiple process (nodejs worker) checking different part of pending jobs and they may call execute job at the same time, will redis block other process when one process is executing job and update redis?
- make build and docker more efficient, now i just copy everything to 4 bots
    - it works but it takes a long time to build
    maybe yarn install outside docker then copy node modules over

### profit
- [must do] smart processing, only execute the job when it's profitable
- [must do] after each successful execution / eviction, send the reward to designated wallet, as this bot essentially holds a hot wallet which is not super secure.
- [must do] now we just check the pending jobs by their id in descending order, in the future we may want to try by the order of reward size, but we don't want the competition to be too strong, maybe prefer 2nd or 3rd highest reward.

### others
- differentiate read and write sdk for clarity
- migrate terra.js to feather.js
- put terrad into docker compose?
    - not sure if this is a good idea, is it possible to run mainnet full node in docker mode?
