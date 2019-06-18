## Shifter examples

This directory contains a collection of Ethereum smart contracts for interacting with the Shifter contract. Please note the code is for example purposes only and has not been audited.

### Vesting

The Vesting contract is an example of a Bitcoin vesting contract on the Ethereum blockchain. This contract allows the owner to create vesting schedules for Bitcoin. Beneficiaries can claim the Bitcoin at monthly intervals based on their schedule.

This contract demonstrates the use of the `shiftIn` and `shiftOut` functions in the Shifter contract. `shiftIn` is called when we first add a vesting schedule and `shiftOut` is called when a user wants to claim their vested Bitcoin. We use a `MuShifter` as we want to prevent the commitment and nonce from being reused.