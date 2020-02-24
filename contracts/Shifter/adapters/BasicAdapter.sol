pragma solidity 0.5.16;

import "../IShifter.sol";
import "../IShifterRegistry.sol";

contract BasicAdapter {
    function shiftIn(
        // Payload
        IShifter _shifter,
        IERC20 _shiftedToken,
        address _address,
        // Required
        uint256 _amount,
        bytes32 _nHash,
        bytes calldata _sig
    ) external {
        bytes32 payloadHash = keccak256(
            abi.encode(_shifter, _shiftedToken, _address)
        );
        uint256 amount = _shifter.shiftIn(payloadHash, _amount, _nHash, _sig);
        _shiftedToken.transfer(_address, amount);
    }

    function shiftOut(
        IShifter _shifter,
        IERC20 _shiftedToken,
        bytes calldata _to,
        uint256 _amount
    ) external {
        require(
            _shiftedToken.transferFrom(msg.sender, address(this), _amount),
            "token transfer failed"
        );
        _shifter.shiftOut(_to, _amount);
    }
}
