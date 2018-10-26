#!/bin/sh
set -e

# Setup openzeppelin-eth
sed -i.bak -e 's/"openzeppelin-eth\/contracts\//".\/openzeppelin-eth\/contracts\//' contracts/*.sol
sed -i.bak -e 's/"openzeppelin-eth\/contracts\//"..\/openzeppelin-eth\/contracts\//' contracts/*/*.sol
mkdir ./contracts/openzeppelin-eth
cp -r ./node_modules/openzeppelin-eth/contracts ./contracts/openzeppelin-eth/contracts

# Setup zos-lib
sed -i.bak -e 's/"zos-lib\/contracts\//".\/zos-lib\/contracts\//' contracts/*.sol
sed -i.bak -e 's/"zos-lib\/contracts\//"..\/zos-lib\/contracts\//' contracts/*/*.sol
mkdir ./contracts/zos-lib
cp -r ./node_modules/zos-lib/contracts ./contracts/zos-lib/contracts

### GENERATE BINDINGS HERE ###
abigen --sol ./contracts/Bindings.sol -pkg bindings --out bindings.go

# Revert setup for openzeppelin-eth
sed -i.bak -e 's/".\/openzeppelin-eth\/contracts\//"openzeppelin-eth\/contracts\//' contracts/*.sol
sed -i.bak -e 's/"..\/openzeppelin-eth\/contracts\//"openzeppelin-eth\/contracts\//' contracts/*/*.sol
rm -r ./contracts/openzeppelin-eth

# Revert setup for zos-lib
sed -i.bak -e 's/".\/zos-lib\/contracts\//"zos-lib\/contracts\//' contracts/*.sol
sed -i.bak -e 's/"..\/zos-lib\/contracts\//"zos-lib\/contracts\//' contracts/*/*.sol
rm -r ./contracts/zos-lib

rm contracts/*/*.bak
rm contracts/*.bak
