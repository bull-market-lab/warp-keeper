# list of TODOs

## current progress
except triggering eviction, it should work

## top priority
1. when to use await
2. better msg on connection, on error for ws and redis
3. eviction bot!

## Function
- test if recurring job and requeue job will work
- race condition?
    2 tx in same block
    tx1 create job
    tx2 delete job
    tx2 get processed before tx1 completes, then we fail to process tx2 and left tx1 in limbo

    potential solution: periodically empty redis and refetch all jobs from full node?
- is it possible to put ws into bot
- more error handling
- split job queue into multiple queues by job status
- migrate terra.js to feather.js

## Monitor
- integrate grafana metrics
- setup pager duty to alert when bot / ws down
- able to detect contract migration (that leads to schema change / breaking api change)
- better error msg and logging

## Performance
- add more to cache (condition, template, etc)
- use dev dependency
- divide jobs into different queue by their type
    timestamp, block height
    query
- look into each function in sdk and calculate number of api call per operation
- check if redis operation is thread safe
    i.e. we want to have multiple process (nodejs worker) checking different part of pending jobs and they may call execute job at the same time, will redis block other process when one process is executing job and update redis?

## Profit
- smart processing, only execute the job when it's profitable

## others
- fix linting, now lint always need 1 more commit
- check existence before adding to redis, shouldn't be a big deal as we only use set and map
- styling, function parameters follow same order
- differentiate read and write sdk for clarity
