# list of TODOs
## top priority
1. when to use await
2. better msg on connection, on error for ws and redis

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
- multithreading
    nodejs worker
- add more to cache (condition, template, etc)
- use dev dependency
- divide jobs into different queue by their type
    timestamp, blockheight
    query
- look into each function in sdk and calculate number of api call per operation

## Profit
- smart processing, only execute the job when it's profitable
