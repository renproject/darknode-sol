pragma solidity ^0.4.18;

import "./ECDSA.sol";

contract Token {
  function transfer(address, uint256) public returns (bool);
  function balanceOf(address) public view returns (uint256);
  function transferFrom(address, address, uint256) public returns (bool);
  function allowance(address, address) public view returns (uint256);
}

library Arc1 {
  address internal constant ETHEREUM = 0x1;

  enum Status {
    pending, initiated, redeemed, refunded
  }

  struct Swap {
    address caller;

    address sender;
    bytes32 senderKey;
    bytes senderSignature;

    address receiver;
    bytes32 receiverKey;
    bytes receiverSignature;
    
    address tokenAddress;
    uint256 value;

    bytes32 dualKey;
    bytes receiverDualSignature;
    bytes senderDualSignature;

    uint256 expiry;
    Status status;
  }

  function initiate(Swap storage self, bytes _senderSignature, bytes32 _senderKey, address _tokenAddress, uint256 _value, uint256 _validity, address _sender) internal {
    require(ECDSA.verify(_senderSignature, _senderKey, _sender));
    require(self.status == Status.pending);
    if (_tokenAddress == address(0x0) || _tokenAddress == ETHEREUM) {
      self.tokenAddress = ETHEREUM;
    } else {
      self.tokenAddress = _tokenAddress;
    }
    self.caller = msg.sender;
    self.senderSignature = _senderSignature;
    self.sender = _sender;
    self.senderKey = _senderKey;
    self.value = _value;
    self.expiry = now + _validity;
    self.status = Status.initiated;
  }

  function audit(Swap storage self) internal view returns (address, uint256, uint256) {
    require(verify(self.tokenAddress, self.value, self.caller));
    return (self.tokenAddress, self.value, self.expiry);
  }

  function redeem(Swap storage self, address _receiver, bytes32 _receiverKey, bytes _receiverSignature, bytes _senderDualSignature, bytes _receiverDualSignature) internal {
    require(self.status == Status.initiated);
    self.receiverKey = _receiverKey;
    self.receiverSignature = _receiverSignature;
    self.receiverDualSignature = _receiverDualSignature;
    self.senderDualSignature = _senderDualSignature;
    self.receiver = _receiver;
    validate(self);
    self.status = Status.redeemed;
    withdraw(self.tokenAddress, self.value, self.receiver, self.caller);
  }

  function refund(Swap storage self, address _tokenAddress, uint256 _value) internal {
    require(self.status == Status.initiated);
    require(now >= self.expiry);
    self.status = Status.refunded;
    withdraw(_tokenAddress, _value, self.sender, self.caller);
  }

  function auditSecret(Swap storage self) internal constant returns (bytes, bytes) {
    return (self.senderDualSignature, self.receiverDualSignature);
  }

  function validate(Swap storage self) internal view {
    address receiver = ECDSA.addr(self.receiverSignature, self.receiverKey);
    require(receiver == self.receiver);
    self.dualKey = getDualKey(self.senderSignature, self.receiverSignature);
    require(ECDSA.verify(self.senderDualSignature, self.dualKey, self.sender));
    require(ECDSA.verify(self.receiverDualSignature, self.dualKey, self.receiver));
  }

  function getDualKey(bytes _sigA, bytes _sigB) internal pure returns (bytes32) {
    if (keccak256(_sigA) < keccak256(_sigB)) {
      return keccak256(_sigA, _sigB);
    } else {
      return keccak256(_sigB, _sigA);
    }
  }

  function verify(address _tokenAddress, uint256 _value, address _callerContractAddress) internal view returns (bool) {
    if (_tokenAddress == 0x0) {
      return(false);
    } else if (_tokenAddress == 0x1) {
      return(_callerContractAddress.balance >= _value);
    } else {
      Token t = Token(_tokenAddress);
      return(t.balanceOf(_callerContractAddress) >= _value);
    }
  }

  function withdraw(address _tokenAddress, uint256 _value, address _receiver, address _callerContractAddress) internal {
    require(verify(_tokenAddress, _value, _callerContractAddress));
    if (_tokenAddress == ETHEREUM) {
      _receiver.transfer(_value);
    } else {
      Token t = Token(_tokenAddress);
      require(t.transfer(_receiver, _value));
    }
  }
}