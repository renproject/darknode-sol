pragma solidity ^0.4.18;

contract Token {
  function transfer(address, uint256) public returns (bool);
  function balanceOf(address) public view returns (uint256);
  function transferFrom(address, address, uint256) public returns (bool);
  function allowance(address, address) public view returns (uint256);
}

library Arc0 {
  address internal constant ETHEREUM = 0x1;

  enum Status {
    pending, initiated, redeemed, refunded
  }

  struct Swap {
    address caller;
    
    address sender;
    address receiver;

    address tokenAddress;
    uint256 value;
    
    bytes secret;
    bytes32 secretLock;

    uint256 expiry;
    Status status;
  }

  function initiate(Swap storage self,  bytes32 _secretLock, address _tokenAddress, uint256 _value, uint256 _validity, address _sender, address _receiver) internal {

    if (_tokenAddress == address(0x0) || _tokenAddress == ETHEREUM) {
      self.tokenAddress = ETHEREUM;
    } else {
      self.tokenAddress = _tokenAddress;
    }

    self.caller = msg.sender;
    self.secretLock = _secretLock;
    self.sender = _sender;
    self.receiver = _receiver;
    self.value = _value;
    self.expiry = now + _validity;
    self.status = Status.initiated;
  }

  function audit(Swap storage self) internal view returns (address, uint256, address, uint256) {
    require(self.status == Status.initiated);
    // require(verify(self.tokenAddress, self.value, self.caller));
    return (self.tokenAddress, self.value, self.receiver, self.expiry);
  }

  function redeem(Swap storage self, bytes _secret) internal {
    require(self.status == Status.initiated);
    require(self.secretLock == sha256(_secret));
    self.secret = _secret;
    self.status = Status.redeemed;
    withdraw(self.tokenAddress, self.value, self.receiver, self.caller);
  }

  function refund(Swap storage self, address _tokenAddress, uint256 _value) internal {
    require(self.status == Status.initiated);
    require(now >= self.expiry);
    self.status = Status.refunded;
    withdraw(_tokenAddress, _value, self.sender, self.caller);
  }

  function auditSecret(Swap storage self) internal constant returns (bytes) {
    return self.secret;
  }

  function verify(address _tokenAddress, uint256 _value, address _callerContractAddress) internal view returns (bool) {
    if (_tokenAddress == ETHEREUM) {
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
      t.transfer(_receiver, _value);
    }
  }
}