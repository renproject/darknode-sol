# Paying the Darknodes

There are two contracts used for paying off the darknodes. `DarknodePayment` and `DarknodePayroll`.


## DarknodePayroll

The `DarknodePayroll` contract holds the funds that will be distributed to the darknodes as well as stores the balances of the darknodes and which darknodes have been black or whitelisted. It also keeps track of the current payment cycle and the reward pool and reward share for the previous cycle.

Darknodes won't usually have to interact with the `DarknodePayroll` contract. The main function for interaction is `changeCycle()` which can be called after the minimum cycle time has passed. `changeCycle()` changes the current cycle, updates the black and whitelist numbers, and most importantly snapshots the current token balances to be distributed to the darknodes.

There is an incentive for people to call the `changeCycle()` function since darknodes need to be whitelisted for a least one full cycle before they can participate in rewards. So although calling `changeCycle()` isn't a requirement, there is still an incentive to do so.

Snapshotting balances involves iterating through the list of `supportedTokens`. Tokens can be registered by calling the `registerToken()` function. This adds the token to the list of tokens which will be snapshotted.

## Permissions

The `blacklist()` function can only be called by `darknodeJudge`. This is an address which has the ability to blacklist, defaults to the owner of the contract. The `darknodeJudge` can be changed using the `updateDarknodeJudge()`.

The `whitelist()` and `claim()` functions can only be called by the `DarknodePayment` contract. The current address of the `DarknodePayment` contract can be updated using the `updateDarknodePayment()` function.

The `registerToken()`, `updateDarknodePayment()`, `updateDarknodeJudge()`, `updateCycleDuration()`, and `unBlacklist()` functions can only be called by the owner of the contract.



## DarknodePayment

The two functions exposed by `DarknodePayment` are the `withdraw()` and `claim()` functions. The `claim()` has two main roles, whitelisting the darknode, and claiming rewards for previous cycles. If the darknode that gets passed to `claim()` has not been whitelisted, the `DarknodePayment` contract will call `DarknodePayroll.whitelist()`. Otherwise, it will call `DarknodePayroll.claim()` to claim for the darknode the rewards for the previous cycle.

The `withdraw()` function simply calls `DarknodePayroll.transfer()`.
