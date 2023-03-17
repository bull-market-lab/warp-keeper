# warp-keeper
## features
redis for caching

filtering out low reward jobs

## testing
when not sure, always use await

## challenge
how to submit multiple job in short time?
seeing sequence number error (expect next, still got current in createAndSignTx)
solution 1: use multiple wallet!!
solution 2: put multiple execute job in 1 tx
  but that will revert entire tx if 1 execute job fail
✅ solution 3: manually set sequence, increment after each execution, do no infer sequence
