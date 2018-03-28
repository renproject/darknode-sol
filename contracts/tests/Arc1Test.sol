pragma solidity ^0.4.18;

import "../libraries/Arc1.sol";

contract Arc1Test {
  
  using Arc1 for Arc1.Swap;
  Arc1.Swap private swap;

  function Arc1Test(bytes32 _senderKey, bytes _senderSignature, uint256 _validity, uint256 _value, address _tokenAddress) public {
    swap.initiate(_senderSignature, _senderKey, _tokenAddress, _value, _validity, msg.sender);
  }

  function () public payable {
  }

  function redeem(bytes32 _receiverKey, bytes _receiverSignature, bytes _senderDualSignature, bytes _receiverDualSignature) public {
    swap.redeem(msg.sender, _receiverKey, _receiverSignature, _senderDualSignature, _receiverDualSignature);
  }

  function refund(address _tokenAddress, uint256 _value) public {
    swap.refund(_tokenAddress, _value);
  }

  function audit() public view returns(address, uint256, uint256) {
    return swap.audit();
  }

  function auditSecret() public view returns(bytes, bytes) {
    return swap.auditSecret();
  }

  function dualKey(bytes _sigA, bytes _sigB) public pure returns (bytes32) {
    return Arc1.getDualKey(_sigA, _sigB);
  }

}