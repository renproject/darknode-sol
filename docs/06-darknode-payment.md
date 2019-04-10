# Paying the Darknodes

There are two contracts used for paying off the darknodes: `DarknodePayment` and `DarknodePaymentStore`.


## DarknodePayment

The `DarknodePayment` contract keeps track of the current payment cycle and the reward pool and reward share for the previous cycle.

Darknodes will mainly interact with the `DarknodePayment` contract for whitelisting and claiming rewards. The main function for interaction is `changeCycle()` which can be called after the minimum cycle time has passed. The next time a cycle can be called is stored in the `cycleTimeout` variable.

`changeCycle()` performs the following actions:

* Snapshot the current token balances based off `shareSize` (the number of whitelisted darknodes last cycle). This will allocate a share of reward for each of the whitelisted darknodes from last cycle. Newly whitelisted darknodes will not get a share.
* Update the `currentCycle` and `previousCycle` variables.
* Updates the `shareSize` to the current number of whitelisted darknodes.
* Updates the list of registered tokens. Tokens pending registration will be registered and tokens pending deregistration will be deregistered.

A few of these actions such as handling snapshotting of balances and registration of tokens, involve iterating through a list of `supportedTokens`. Tokens can be registered by calling the `registerToken()` function. Tokens can be deregistered using `deregisterToken()`.

There is an incentive for people to call the `changeCycle()` function since darknodes need to be whitelisted for a least one full cycle before they can participate in rewards. So although calling `changeCycle()` isn't a requirement, there is still an incentive to do so.

### Permissions

The `blacklist()` function can only be called by `darknodeJudge`. This is an address which has the ability to blacklist, defaults to the owner of the contract. The `darknodeJudge` can be changed using the `updateDarknodeJudge()`.

The `transferStoreOwnership()`, `claimStoreOwnership()`, `registerToken()`, `deregisterToken()`, `updateDarknodeJudge()`, `updateCycleDuration()` functions can only be called by the owner of the contract.

All other functions are external functions callable by anyone.

## DarknodePaymentStore

The `DarknodePaymentStore` handles the storage of the whitelist, blacklist, darknode balances, and storing of funds. Any funds transferred to `DarknodePayment` are forwarded to the `DarknodePaymentStore`. This allows the `DarknodePayment` contract to be scrapped without losing critical information.

The `DarknodePaymentStore` is a claimable contract whose owner should be the `DarknodePayment` contract.

The balances of darknodes can only ever be increased using the `incrementDarknodeBalances()` function. The balances will decrease only when the `transfer()` function is called. This will transfer a specified amount to the specified recipient, deducting the specified amount from the darknode balance.
