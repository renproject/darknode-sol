# `ren-sol`

`ren-sol` contains the next iteration of the REN bonding and rewards claiming contracts.

## Docs

Contract documentation will be available when the contract interfaces are finalized. The contracts are simple enough that in most cases, reading the source code is sufficient and efficient enough.

## Development

`ren-sol` uses [Hardhat](https://hardhat.org).

### Setup

Install the dependencies using:

```sh
yarn
```

### Testing

```sh
yarn hardhat test
```

### Misc.

If you are using VSCode with the Solidity extension, create the file `.vscode/settings.json` with the following settings:

```json
{
  "solidity.packageDefaultDependenciesContractsDirectory": ""
}
```
