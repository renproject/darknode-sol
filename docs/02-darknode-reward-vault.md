# Darknode Reward Vault

After finding matching orders, confirming the match with the [Orderbook](./04-orderbook.md), and settling the match with the [Settlement Layer](./05-settlement.md), Darknodes are rewarded with a fee. This fee provides an economic incentive for the Darknodes to run the Secure Order Matcher on behalf of third-party dark pools. The Darknode Reward Vault is an Ethereum smart contract that collects these rewards and allows the Darknode operators to withdraw them. 

![Overview](./images/02-darknode-reward-vault-overview.jpg "Overview")

## Tokens

The tokens used to pay the fee is defined by the Settlement Layer. Third-party dark pools that propose Settlement Layers with inappropriate tokens will not be accepted into the set of approved third-party dark pools. This provides third-party dark pools with the flexibility to pay fees in tokens that are not necessarily related to the cryptographic assets being traded due to regulation, or the fact that not all cryptographic assets can be sensibly used for paying fees (e.g. tokenised shares in a company).

## Amount

The amount of tokens paid as a fee is defined by the Settlement Layer. Third-party dark pools that propose Settlement Layers with inappropriate tokens will not be accepted into the set of approved third-party dark pools. This provides third-party dark pools with the opportunity to be competitive with their fees, not only in amount but also in structure. Settlement Layers may define fees as a flat rate, or as a percentage of the matching orders.

## Darknode Operators

Darknode operators are the Ethereum accounts used to register a Darknode in the [Darknode Registry](./01-darknode-registry.md). Fees earned by a Darknode are deposited into the Darknode Reward Vault and can be withdrawn by the respective Darknode operator. Any account can initiate the withdrawal, but the Darknode operator will always be the account that receives the funds.

***Important**: Deregistering a Darknode will prevent fees earned by the Darknode from being withdrawn. A Darknode operator must ensure that all fees have been withdrawn before deregistering a Darknode.*