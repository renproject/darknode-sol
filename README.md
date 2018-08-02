# Republic Protocol — Solidity

[![Build Status](https://travis-ci.org/republicprotocol/republic-sol.svg?branch=master)](https://travis-ci.org/republicprotocol/republic-sol)
[![Coverage Status](https://coveralls.io/repos/github/republicprotocol/republic-sol/badge.svg?branch=master)](https://coveralls.io/github/republicprotocol/republic-sol?branch=master)
[Documentation](./docs/index.md)

**Republic Protocol — Solidity** is the official reference implementation of Republic Protocol on Ethereum, written in Solidity. Republic Protocol uses Ethereum as a trusted third-party computer to perform computations that must not be corrupted, and reach consensus on the state of orders.

Republic Protocol runs the Secure Order Matcher — the core component of the protocol — in a decentralised network of Darknodes that is distinct from Ethereum. This ensure the performance of the network, and the privacy of data. See [Republic Protocol - Go](https://github.com/republicprotocol/republic-go) for the official reference implementation of Republic Protocol, written in Go.

## Tests

Install the dependencies.

```
npm install
```

Run the `ganache-cli` or an alternate Ethereum test RPC server on port 8545.

```sh
npx ganache-cli
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