# list of TODOs

## current status
MVP should be considered as completed, optimization and corner cases still need to be taken care of.

## next steps
- determine if we need to block in ws. i.e. handle ws event one after another
    - i guess so, if we receive any job update event, we want to reflect that in redis as soon as possible to avoid executing executed / deleted job
    - it would make log very clear if we can make it blocking
- fix eslint suggestions
- finish all TODOs in code
- race condition?
    - 2 tx in same block, tx1 create job, tx2 delete job, tx2 get processed before tx1 completes, then we fail to process tx2 and left tx1 in limbo
    - potential solution: periodically empty redis and refetch all jobs from full node?
- go over each redis operation, when to delete everything vs only id
- better logging, like centralizing log to one place, currently we log in redis_helper and ws_helper

## improvements
### monitor
- [must do] go over all place where we might throw exception
- [must do] setup pager duty to alert when bot / ws down
    - pager duty doesn't have small business plan, use sentry instead
- [must do] able to detect contract migration (that leads to schema change / api breaking change )
- integrate grafana metrics

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

### others
- differentiate read and write sdk for clarity
- migrate terra.js to feather.js
- put terrad into docker compose?
    - not sure if this is a good idea, is it possible to run mainnet full node in docker mode?
