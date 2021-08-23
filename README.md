# `⚖️ darknode-sol`

## Ethereum smart contracts for managing darknodes

[![CircleCI](https://circleci.com/gh/renproject/darknode-sol.svg?style=shield)](https://circleci.com/gh/renproject/darknode-sol)
[![Coverage Status](https://coveralls.io/repos/github/renproject/darknode-sol/badge.svg?branch=master)](https://coveralls.io/github/renproject/darknode-sol?branch=master)

Ren has two repositories for its Solidity contract:

-   `darknode-sol` (this repository) - contracts on Ethereum for managing darknode registrations.
-   [`gateway-sol`](https://github.com/renproject/gateway-sol) - contracts on multiple EVM chains for minting and burning of ren-assets.

Ren bootstraps off Ethereum to handle the REN token and darknode registrations.

## ~ [Documentation](https://renproject.github.io/ren-client-docs/contracts/) ~

-   For the latest contract addresses, see the [contract addresses](https://renproject.github.io/ren-client-docs/contracts/deployments) page.
-   For a summary of each contract, see the [summary of contracts](https://renproject.github.io/ren-client-docs/contracts/summary) page.

<details>

<summary>Development notes</summary>

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

</details>
