# list of TODOs

## Function
- test if recurring job and requeue job will work
- race condition?
    2 tx in same block
    tx1 create job
    tx2 delete job
    tx2 get processed before tx1 completes, then we fail to process tx2 and left tx1 in limbo

    potential solution: periodically empty redis and refetch all jobs from full node?
- is it possible to put ws into bot

## Monitor
- integrate grafana metrics
- setup pager duty to alert when bot / ws down
- able to detect contract migration (that leads to schema change / breaking api change)

## Performance
- multithreading
- add more to cache (condition, template, etc)
- use dev dependency

## Profit
- smart processing, only execute the job when it's profitable
