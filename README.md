# `⚖️ darknode-sol`

## Ethereum smart contracts for managing darknodes

[![CircleCI](https://circleci.com/gh/renproject/darknode-sol.svg?style=shield)](https://circleci.com/gh/renproject/darknode-sol)
[![Coverage Status](https://coveralls.io/repos/github/renproject/darknode-sol/badge.svg?branch=master)](https://coveralls.io/github/renproject/darknode-sol?branch=master)

Ren has two repositories for its Solidity contract:

- `darknode-sol` (this repository) - contracts on Ethereum for managing darknode registrations.
- [`gateway-sol`](https://github.com/renproject/gateway-sol) - contracts on multiple EVM chains for minting and burning of ren-assets.

Ren bootstraps off Ethereum to handle the REN token and darknode registrations.

## ~ [Documentation](https://renproject.github.io/ren-client-docs/contracts/) ~

- For the latest contract addresses, see the [contract addresses](https://renproject.github.io/ren-client-docs/contracts/deployments) page.
- For a summary of each contract, see the [summary of contracts](https://renproject.github.io/ren-client-docs/contracts/summary) page.

<details>

<summary>Development notes</summary>

# Boilerplate for ethereum solidity smart contract development

## INSTALL

```bash
yarn
```

## TEST

```bash
yarn test
```

## SCRIPTS

Here is the list of npm scripts you can execute:

Some of them relies on [./config/\_scripts.js](./config/_scripts.js) to allow parameterizing it via command line argument (have a look inside if you need modifications)
<br/><br/>

`yarn prepare`

As a standard lifecycle npm script, it is executed automatically upon install. It generate config file and typechain to get you started with type safe contract interactions
<br/><br/>

`yarn lint`, `yarn lint:fix`, `yarn format` and `yarn format:fix`

These will lint and format check your code. the `:fix` version will modifiy the files to match the requirement specified in `.eslintrc` and `.prettierrc.`
<br/><br/>

`yarn compile`

These will compile your contracts
<br/><br/>

`yarn void:deploy`

This will deploy your contracts on the in-memory hardhat network and exit, leaving no trace. quick way to ensure deployments work as intended without consequences
<br/><br/>

`yarn test [mocha args...]`

These will execute your tests using mocha. you can pass extra arguments to mocha
<br/><br/>

`yarn coverage`

These will produce a coverage report in the `coverage/` folder
<br/><br/>

`yarn gas`

These will produce a gas report for function used in the tests
<br/><br/>

`yarn dev`

These will run a local hardhat network on `localhost:8545` and deploy your contracts on it. Plus it will watch for any changes and redeploy them.
<br/><br/>

`yarn local:dev`

This assumes a local node it running on `localhost:8545`. It will deploy your contracts on it. Plus it will watch for any changes and redeploy them.
<br/><br/>

`yarn execute <network> <file.ts> [args...]`

This will execute the script `<file.ts>` against the specified network
<br/><br/>

`yarn deploy <network> [args...]`

This will deploy the contract on the specified network.

Behind the scene it uses `hardhat deploy` command so you can append any argument for it
<br/><br/>

`yarn export <network> <file.json>`

This will export the abi+address of deployed contract to `<file.json>`
<br/><br/>

`yarn fork:execute <network> [--blockNumber <blockNumber>] [--deploy] <file.ts> [args...]`

This will execute the script `<file.ts>` against a temporary fork of the specified network

if `--deploy` is used, deploy scripts will be executed
<br/><br/>

`yarn fork:deploy <network> [--blockNumber <blockNumber>] [args...]`

This will deploy the contract against a temporary fork of the specified network.

Behind the scene it uses `hardhat deploy` command so you can append any argument for it
<br/><br/>

`yarn fork:test <network> [--blockNumber <blockNumber>] [mocha args...]`

This will test the contract against a temporary fork of the specified network.
<br/><br/>

`yarn fork:dev <network> [--blockNumber <blockNumber>] [args...]`

This will deploy the contract against a fork of the specified network and it will keep running as a node.

Behind the scene it uses `hardhat node` command so you can append any argument for it

</details>
