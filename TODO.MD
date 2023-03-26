# list of TODOs

## current progress
except triggering eviction, it should work.
    put eviction bot on hold, warp will fix the bypass eviction I pointed out in next release.

## next steps
pack everything into docker container
    this paves the way for having multiple bot, more similar to mars liquidation bot

determine if we need to block in ws
    i guess so, if we receive any job update event, we want to reflect that in redis as soon as possible to avoid executing executed / deleted job

## improvements
### function
- test if recurring job and requeue job will work
- race condition?
    2 tx in same block
    tx1 create job
    tx2 delete job
    tx2 get processed before tx1 completes, then we fail to process tx2 and left tx1 in limbo

    potential solution: periodically empty redis and refetch all jobs from full node?
- more error handling

### monitor
- integrate grafana metrics
- setup pager duty to alert when bot / ws down
    pager duty doesn't have small business plan, use sentry instead
- able to detect contract migration (that leads to schema change / breaking api change)

### performance
- add more to cache (condition, template, etc)
    - depends on contract add variables to log
- divide jobs into different queue by their type
    timestamp, block height
    query
- look into each function in sdk and calculate number of api call per operation
- check if redis operation is thread safe
    i.e. we want to have multiple process (nodejs worker) checking different part of pending jobs and they may call execute job at the same time, will redis block other process when one process is executing job and update redis?

### profit
- smart processing, only execute the job when it's profitable

### others
- fix linting, now lint always need 1 more commit
- styling, function parameters follow same order
- differentiate read and write sdk for clarity
- migrate terra.js to feather.js
