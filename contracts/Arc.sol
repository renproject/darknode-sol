pragma solidity ^0.4.18;

import "./libraries/Arc0.sol";

contract Arc {
  Arc0.Swap private swap;

  function Arc(bytes32 _secretLock, address _tokenAddress, uint256 _value, uint256 _validity, address _receiver) public {
    Arc0.initiate(swap, _secretLock, _tokenAddress, _value, _validity, msg.sender, _receiver);
  }

  function () public payable {

  }

  function test() public view returns (bytes32 _secretLock, address _tokenAddress, uint256 _value, uint256 _validity, address _receiver) {
    return (swap.secretLock, swap.tokenAddress, swap.value, swap.expiry, swap.receiver);
  }

  function test2(bytes32 _secretLock, address _tokenAddress, uint256 _value, uint256 _validity, address _receiver) public view returns (bytes32, address, uint256, uint256, address) {
    return (_secretLock, _tokenAddress, _value, _validity, _receiver);
  }

  function redeem(bytes _secret) public {
    Arc0.redeem(swap, _secret);
  }

  function audit() public view returns (address, uint256, address, uint256) {
    return Arc0.audit(swap);
  }

  function auditSecret() public view returns (bytes) {
    return Arc0.auditSecret(swap);
  }

  function refund(address _tokenAddress, uint256 _value) public {
    Arc0.refund(swap, _tokenAddress, _value);
  }

}

