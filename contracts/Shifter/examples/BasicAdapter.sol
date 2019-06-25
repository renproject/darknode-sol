pragma solidity ^0.5.8;

import "../Shifter.sol";

contract BasicAdapter {
    BTCShifter public btc;

    constructor(BTCShifter _btc) public {
        btc = _btc;
    }

    function shiftIn(
        uint256        _amount,
        bytes32        _nonce,
        bytes calldata _sig,
        address        _address
    ) external {
        bytes32 payloadHash = keccak256(abi.encode(_address));
        btc.shiftIn(payloadHash, _amount, _nonce, _sig);
    }

    function shiftOut(
        bytes calldata _to,
        uint256        _amount
    ) external {
        btc.shiftOut(_to, _amount);
    }
}