pragma solidity ^0.5.8;

import "./Shifter.sol";

contract MuShifter {
    Shifter public shifter;
    mapping (bytes32 => mapping (bytes32 => bool)) public seen;

    constructor(Shifter _shifter) public {
        shifter = _shifter;
    }

    /// @notice shiftIn mints new tokens after verifying the signature and
    /// transfers the tokens to `_to`.
    function shiftIn(
        address _to,
        uint256 _amount,
        bytes32 _nonce,
        bytes32 _commitment,
        bytes memory _sig
    ) public returns (uint256) {

        require(!seen[_commitment][_nonce], "commitment already seen");
        if (shifter.status(_commitment, _nonce) == Shifter.ShiftResult.New) {
            shifter.shiftIn(_to, _amount, _nonce, _commitment, _sig);
        }
        seen[_commitment][_nonce] = true;



        return Shifter(shifter).shiftIn(_to, _amount, _nonce, _commitment, _sig);
    }

    /// @notice shiftOut burns tokens after taking a fee for the `_feeRecipient`.
    function shiftOut(bytes memory _to, uint256 _amount) public returns (uint256) {
        return Shifter(shifter).forwardShiftOut(msg.sender, _to, _amount);
    }
}

/* solium-disable no-empty-blocks */
contract BTCMuShifter is MuShifter {
    constructor(Shifter _shifter)
        MuShifter(_shifter) public {
    }
}

contract ZECMuShifter is MuShifter {
    constructor(Shifter _shifter)
        MuShifter(_shifter) public {
    }
}