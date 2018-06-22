# Orderbook

Orderbook (formerly know as Hyperdrive) is an Ethereum smart contract which store all the orders and their priority.
As a trader, it needs to open the order to Orderbook first. Darknodes should look up orders in the contract and match them in terms of their priorities.  Both the traders and darknodes need to send 
the signed message in order to open, cancel or confirm orders.

**Usage**

OpenOrder (orderID, traderSignature)  

> The traderSignature will be the signature of the message "Republic Protocol: open: {orderHash}" signed by the trader

ConfirmOrder (orderID, darknodeSignature)  

> The darknodeSignature will be the signature of the message "Republic Protocol: match: {orderHash}" signed by the darknode.
We need to verify the darknode is registered.

CancelOrder (orderID, traderSignature)  
 
 > The traderSignature will be the signature of the message "Republic Protocol: cancel: {orderHash}" signed by the trader.
 The trader should be the same with the one who open the order.
 
 
 
