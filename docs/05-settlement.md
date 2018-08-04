# Settlement

*Settlement Layers* are defined by third-party dark pools. Darknodes will submit matching orders to their respective Settlement Layers — designated when the order is opened on the [Orderbook](./04-orderbook.md) — and the Settlement Layer is expected to implement the execution of these orders. The exact nature of the execution is left to the third-party dark pool, but it is assumed that users of the dark pool are satisfied with how these rule are implemented.

![Overview](./images/05-settlement-overview.jpg "Overview")

During settlement, the Settlement Layer is expected to pay a fee to the [Darknode Reward Vault](./02-darknode-reward-vault.md) so that the Darknodes involved in matching the orders can be rewarded. This is enforced using a reputation system; failing to pay the fee will result in Darknodes ignoring orders designated to the malicious dark pool. Being ignored by Darknodes will result in reduced performance / reliability of order matching for the third-party dark pool, and being ignored by too many Darknodes will result in the complete stopping of order matching.

## Settlement Identifier

Settlement layers are assigned a unique *Settlement Identifier* when accepted into the set of approved third-party dark pools. A third-party dark pool can define multiple Settlement Layers, however each Settlement Layer will still have a unique Settlement Identifier. Orders designate a Settlement Layer using the Settlement Identifier.

## Settlement ABI

The *Settlement ABI* is an interface defined by Republic Protocol that will be used by Darknodes when interacting with a Settlement Layer. To be compatible with Republic Protocol, a third-party dark pool must ensure that its Settlement Layers expose the required Settlement ABI.

The Settlement ABI is composed of two stages:
1. The submission of orders to be settled, and
2. the executing the settlement of submitted orders.

The current version of the *Settlement ABI* only supports settlements that involve exactly two orders. It will be extended in the future to support settlement that involves more than two orders, and this extension will be defined in a way that is backwards compatible.

### Submitting orders for settlement

```sol
function submitOrder(bytes _order, uint64 _settlement, uint64 _tokens, uint256 _price, uint256 _volume, uint256 _minVolume) { /* ... */ }
```

### Executing a settlement

```sol
function settle(bytes32 _buy, bytes32 _sell) { /* ... */ }
```

### Requirements

Third-party dark pools have the flexibility to define the exact rules for Settlement Layers, including the fee structure, however, Darknodes will not accept a third-party dark pool unless its Settlement Layers respect some basic requirements. Settlement Layers must:

1. verify the submitted orders are submitted by a registered Darknode,
2. verify the submitted orders are a confirmed match in the [Orderbook](./04-orderbook.md),
3. pay a fee to the Darknodes using the [Darknode Reward Vault](./02-darknode-reward-vault.md), and
4. pay the fee to the Darknodes that called `submitOrder`.

Meeting these requirement is considered necessary, but not sufficient, for being accepted by the Darknodes. For example, a Settlement Layer might define a fee payment to the Darknodes in accordance with (2), but it might use a token that is not recognised by the Darknodes as valuable.