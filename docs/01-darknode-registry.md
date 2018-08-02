# Darknode Registry

The Darknode Registry is an Ethereum smart contract used to register, and deregister, Darknodes. Before a Darknode is accepted into the network by others, it must submit a bond of 100,000REN to the Darknode Registry. After deregistration, the Darknode can refund this bond.

## Epochs

The Darknode Registry partitions time into discrete intervals, called *epochs*, and changes to the registration state of a Darknode are restricted to these discrete intervals.

The registration of a Darknode is considered pending until the beginning of the next epoch. Likewise, the deregistration of an epoch is pending until the beginning of the next epoch. Once deregistration is approved, another full epoch must pass before the bond can be refunded.

## Registration

![Timeline](./images/01-darknode-registry-timeline.jpg "Timeline")

**(1) Pending Registration**
  The bond is sent to the Darknode Registry and the Darknode is in the *Pending Registration* state until the beginning of the next epoch. The account sending this transaction is consdered to be the Darknode operator.

**(2) Registered**
  The registration is approved and the Darknode is in the *Registered* state. The Darknode is now considerd active.

**(3) Pending Deregistration**
  The intent to deregister is sent to the Darknode Registry and the Darknode is in the *Pending Deregistration* state until the beginning of the next epoch. During this time, the Darknode is still considered to be active.

**(4) Deregistered**
  The deregistration is approved and the Darknode is in the *Deregistered* state. It is no longer considered active.

**(5) Cooling**
  The Darknode is no longer considered active. The bond cannot be refunded until the beginning of the next epoch.

**(6) Refunded**
  The intent to refund is sent to the Darknode Registry and the bond is returned to the Darknode operator. The Darknode is removed from the Darknode Registry and can be regsitered again by any account.