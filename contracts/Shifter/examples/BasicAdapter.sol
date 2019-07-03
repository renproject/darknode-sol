pragma solidity ^0.5.8;

import "../Shifter.sol";

contract BasicAdapter {

   function shiftIn(
       // Payload
       Shifter        _shifter,
       address        _address,
       // Required
       uint256        _amount,
       bytes32        _nonce,
       bytes calldata _sig
   ) external {
       bytes32 payloadHash = keccak256(abi.encode(_shifter, _address));
       uint256 amount = _shifter.shiftIn(payloadHash, _amount, _nonce, _sig);
       _shifter.token().transfer(_address, amount);
   }

   function shiftOut(
       Shifter        _shifter,
       bytes calldata _to,
       uint256        _amount
   ) external {
       require(_shifter.token().transferFrom(msg.sender, address(this), _amount), "token transfer failed");
       _shifter.shiftOut(_to, _amount);
   }
}
