#!/usr/bin/env bash


# Setup
sed -i "" -e 's/"openzeppelin-solidity\/contracts\//".\/openzeppelin-solidity\/contracts\//' contracts/*.sol contracts/*/*.sol
mkdir ./contracts/openzeppelin-solidity
cp -r ./node_modules/openzeppelin-solidity/contracts ./contracts/openzeppelin-solidity/contracts

### GENERATE BINDINGS HERE

# Registry
#abigen --sol ./republic-sol/contracts/DarknodeRegistry.sol -pkg bindings --out dnr.go
#abigen --sol ./republic-sol/contracts/Arc.sol -pkg bindings --out arc.go
abigen --sol ./contracts/Orderbook.sol -pkg bindings --out bindings.go
#abigen --sol ./republic-sol/contracts/Arc.sol -pkg bindings --out arc.go


# Revert setup
sed -i "" -e 's/".\/openzeppelin-solidity\/contracts\//"openzeppelin-solidity\/contracts\//' contracts/*.sol contracts/*/*.sol
rm -r ./contracts/openzeppelin-solidity


