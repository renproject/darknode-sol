# `⚖️ darknode-sol`
## Solidity smart contracts used by Ren Darknodes

[![CircleCI](https://circleci.com/gh/renproject/darknode-sol.svg?style=shield)](https://circleci.com/gh/renproject/darknode-sol)
[![Coverage Status](https://coveralls.io/repos/github/renproject/darknode-sol/badge.svg?branch=master)](https://coveralls.io/github/renproject/darknode-sol?branch=master)

**`darknode-sol`** contains a collection of Ethereum smart contracts utilized by the Ren Darknodes, written in Solidity. Ren bootstraps off Ethereum as a trusted third-party computer to handle Darknode registration and fee payouts.

Ren is powered by the RenVM — the Ren Virtual Machine — in a decentralized network of Darknodes that is distinct from Ethereum. This ensures the performance of the network, and the privacy of data, is not dependent on Ethereum.

## Tests

Install the dependencies.

```
yarn install
```

Run the `ganache-cli` or an alternate Ethereum test RPC server on port 8545. The `-d` flag will use a deterministic mnemonic for reproducibility.

```sh
yarn ganache-cli -d
```

Run the Truffle test suite.

```sh
yarn run test
```

## Coverage

Run the Truffle test suite with coverage.

```sh
yarn run coverage
```

Open the coverage file.

```sh
open ./coverage/index.html
```

## Deploying

Add a `.env`, filling in the mnemonic and Infura key:

```sh
MNEMONIC_KOVAN="..."
MNEMONIC_MAINNET="..."
INFURA_KEY="..."
```

Deploy to Kovan:

```sh
NETWORK=kovan yarn run deploy
```

See `1_darknodes.js` for additional instructions.

## Verifying Contract Code

Add an Etherscan API key to your `.env`:

```
ETHERSCAN_KEY="..."
```

Run the following (replacing the network and contract name):

```sh
NETWORK=mainnet yarn run verify Contract1 Contract2
```
