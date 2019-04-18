# `darknode-sol`
## Solidity smart contracts used by Ren Darknodes

[![Build Status](https://travis-ci.org/republicprotocol/republic-sol.svg?branch=master)](https://travis-ci.org/republicprotocol/republic-sol)
[![Coverage Status](https://coveralls.io/repos/github/republicprotocol/republic-sol/badge.svg?branch=master)](https://coveralls.io/github/republicprotocol/republic-sol?branch=master)

**`darknode-sol`** contains a collection of Ethereum smart contracts utilized by the Ren Darknodes, written in Solidity. Ren bootstraps off Ethereum as a trusted third-party computer to handle Darknode registration and fee payouts.

Ren is powered by the RenVM — the Ren Virtual Machine — in a decentralized network of Darknodes that is distinct from Ethereum. This ensures the performance of the network, and the privacy of data, is not dependent on Ethereum.

## Docs

* [Darknode Registry](./docs/01-darknode-registry.md)
* [Darknode Payments](./docs/02-darknode-payments.md)

## Tests

Install the dependencies.

```
npm install
```

Run the `ganache-cli` or an alternate Ethereum test RPC server on port 8545.

```sh
npx ganache-cli -d
```

Run the Truffle test suite.

```sh
npm run test
```

## Coverage

Install the dependencies.

```
npm install
```

Run the Truffle test suite with coverage.

```sh
npm run coverage
```

## Deploying

Deploy to Kovan:

```sh
npm run deployToKovan
```
