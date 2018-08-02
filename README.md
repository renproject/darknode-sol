# Ethereum Republic

[![Build Status](https://travis-ci.org/republicprotocol/republic-sol.svg?branch=master)](https://travis-ci.org/republicprotocol/republic-sol)
[![Coverage Status](https://coveralls.io/repos/github/republicprotocol/republic-sol/badge.svg?branch=master)](https://coveralls.io/github/republicprotocol/republic-sol?branch=master)

The Republic Sol library is the official reference implementation of Republic Protocol on Ethereum, written in Solidity. Republic Protocol does not explicitly require an Ethereum implementation, and future implementations may be developed on other blockchains. For now, Ethereum is used because it is the most battle tested contract platform.

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