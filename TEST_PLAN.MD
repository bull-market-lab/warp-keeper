# Test plan

## test case we should cover

we are not going to write unit test here, we will just use the script and run bot to verify.

1. race condition?
    - create job and delete job in same tx
        - in order to delete a job we need to know the jobId, jobId is unknown until job is created, but we can guess the jobId so it's possible to create then delete in same tx, but why would anyone do that just to waste money?
            - however this might crash the bot, delete job event processed first, create job event handled later, resulting in executor trying to execute an already deleted job
    - create job in tx1 and delete job in tx2

## tester setup

1. create tester warp account
2. deposit to tester warp account cause job reward and eviction fee is withdraw from warp account
3. create job as tester

## keeper setup

1. create keeper warp account
2. run the bot using keeper mnemonic key

## known way of crashing the bot

- tester sends 1 tx contains 2 msgs: first to create a job with condition always true, second to delete the job (because jobId is ascending so we can predict the jobId of job hasn't been created), this leads to collector first add job to queue, monitor mark it as executable, executor trying to execute it before we finish handling the delete msg, but the job is actually deleted in the same tx due to second msg, so execution will always fail.
  - potential solution: handle ws event at block level, instead of at tx event level, this essentially make the bot process every transactions of every block, instead of only process warp_controller tx, but this gives us better control on making the ws event handling atomic, this is also how Mars liquidation bot handles ws event.
