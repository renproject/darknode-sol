#!/bin/sh
set -e

# Setup
sed -i.bak -e 's/"openzeppelin-solidity\/contracts\//".\/openzeppelin-solidity\/contracts\//' contracts/*.sol
sed -i.bak -e 's/"openzeppelin-solidity\/contracts\//"..\/openzeppelin-solidity\/contracts\//' contracts/*/*.sol
mkdir ./contracts/openzeppelin-solidity
cp -r ./node_modules/openzeppelin-solidity/contracts ./contracts/openzeppelin-solidity/contracts

### GENERATE BINDINGS HERE ###
abigen --sol ./contracts/Bindings.sol -pkg bindings --out bindings.go

# Revert setup
sed -i.bak -e 's/".\/openzeppelin-solidity\/contracts\//"openzeppelin-solidity\/contracts\//' contracts/*.sol
sed -i.bak -e 's/"..\/openzeppelin-solidity\/contracts\//"openzeppelin-solidity\/contracts\//' contracts/*/*.sol
rm -r ./contracts/openzeppelin-solidity

rm contracts/*/*.bak
rm contracts/*.bak
