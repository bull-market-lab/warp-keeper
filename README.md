# (WIP) warp-keeper
![warp flow chart](warp_flow_chart.jpg)

## Overview
[Warp](https://warp.money/) is an automation protocol for Cosmos, currently live on Terra. It allows anyone to create a job which is composed of 2 parts: a list of messages (could be any cosmos SDK or cosmwasm message) and a condition (from simple expression like after block height reach x to complex SDK or cw query). When the condition of a job is met, anyone can submit a transaction to execute the job. 

Warp keeper is a solution to find the executable jobs in warp and execute them. It does so by first querying Terra node to save all pending jobs (with sufficient reward cause executing job requires a tx fee, so reward should at least cover the tx fee) into a redis set, then we open a web socket connection to the Terra node and start handling incoming job related events, meanwhile we keep checking our redis pending jobs set to if there's any executable jobs, if we found any we will send tx to Terra node to execute the job.

Note: we only use redis data structures that hold unique elements, so we don't need to worry about adding same job twice causing duplicates.

## Caution
Although this bot should be working at this point, but I'm still tuning it to add proper error handling, analyzing it to make it more efficient and more profitable. 
