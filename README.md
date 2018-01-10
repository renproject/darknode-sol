# Ethereum Republic

> These contracts are a work in progress.

The Ethereum Republic repository contains the official reference implementations of the Republic Protocol on Ethereum, written in Solidity. The Republic Protocol does not explicitly require an Ethereum implementation, and future implementations may be developed on other blockchains. For now, Ethereum is used because it is the most mature smart contract platform available.

## Smart contracts

The Ethereum Republic repository is made up of several different smart contracts that work together to implement the required on-chain functionality. These smart contracts are used by off-chain miners and traders to provide secure decentralized order matching computations.

1. The RepublicToken ERC20 contract implements the Republc Token (REN), used to provide economic incentives.
2. The MinerRegistrar contract implements miner registrations and epochs.
3. The TraderRegistrar contract implements trader registrations.
4. The OrderBook contract implements the opening, closing, and expiration of orders.

None of the contracts expose orders, including the OrderBook, which only holds order IDs. Orders are never passed to the Republic network under any circumstances, and order fragments are never passed to the blockchain.

## Tests

Install all NPM modules and Truffle as a global command.

```
npm install --global truffle
npm install
```

Run the `ganache` script. This script needs to continue running in the background; either run it in a separate terminal, or append the `&` symbol.

```sh
./ganache
```

Run the Truffle test suite.

```sh
truffle test
```

## Republic

The Ethereum Republic contracts are developed by the Republic Protocol team and are available under the MIT license. For more information, see our website https://republicprotocol.com.

## Contributors

* Noah noah@republicprotocol.com
* Susruth susruth@republicprotocol.com
* Loong loong@republicprotocol.com
