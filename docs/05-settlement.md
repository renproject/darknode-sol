# Settlement

Settlement layers are defined by third-party dark pools. Darknodes will submit matching orders to their respective settlement layers — designated when the order is opened on the [Orderbook](./04-orderbook.md) — and the settlement layer is expected to implement the execution of these orders. The exact nature of the execution is left to the third-party dark pool, but it is assumed that users of the dark pool are satisfied with how these rule are implemented.

![Overview](./images/05-settlement-overview.jpg "Overview")

At the time of settlement, the settlemet layer is expected to pay a fee to the Darknodes for the work done to match the orders. This is enforced using a reputation based approached; failing to pay the fee will result in Darknodes ignoring orders designated to the malicious dark pool.

## Settlement Identifier

Third-party dark pools can define multiple settlement layers. For example, the RenEx dark pool supports two settlement layers: Ether-to-ERC20s using non-interactive contracts, and Ether-to-Bitcoin using an interactive atomic swapping technique.

## Settlement ABI

### Submitting orders

```sol
function submitOrder(bytes _order, uint8 _settlement, uint64 _tokens, uint256 _price, uint256 _volume, uint256 _minVolume) returns (bool) { /* ... */ }
```

**Arguments**

- `_order`
  An array of bytes that is not used during settlement but is needed by the Settlement contract to produce the correct order hash. The order hash is produced using `keccak(_order, _settlement, _tokens, _price, _volume, _minVolume)`.
- `_settlement`
  The settlement identifier for this order. The Settlement contract should verify that the settlement identifier of the order matches the settlement identifier of the Settlement contract. This prevents malicious Darknodes from trying to settle orders from one dark pool on another dark pool. However, it also allows for dark pools to intentionally accept inter- dark pool 
- ``

### Settling orders

```sol
function settle(bytes32 _buy, bytes32 _sell) returns (bool) { /* ... */ }
```
