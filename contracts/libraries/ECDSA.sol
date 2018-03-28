pragma solidity ^0.4.18;

import "./Utils.sol";

library ECDSA {

  // function addr(uint8 v, bytes32 r, bytes32 s, bytes32 _hash) internal pure returns (address) {
  //   bytes memory prefix = "\x19Ethereum Signed Message:\n32";
  //   bytes32 prefixedHash = keccak256(prefix, _hash);
  //   return ecrecover(prefixedHash, v, r, s);
  // }

  // function verify(uint8 v, bytes32 r, bytes32 s, bytes32 _hash, address _signer) internal pure returns (bool) {
  //   return (addr(v, r, s, _hash) == _signer);
  // }
  
  function addr(bytes _signature, bytes32 _hash) internal pure returns (address) {
    bytes memory prefix = "\x19Ethereum Signed Message:\n32";
    bytes32 prefixedHash = keccak256(prefix, _hash);
    return ecrecover(prefixedHash, uint8(_signature[64]) + 27, Utils.toBytes32(_signature, 0), Utils.toBytes32(_signature, 32));
  }

  function verify(bytes _signature, bytes32 _hash, address _signer) internal pure returns (bool) {
    return (addr(_signature, _hash) == _signer);
  }

}