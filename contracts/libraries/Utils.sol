pragma solidity ^0.4.19;

library Utils {

  function toBytes32(bytes data, uint pos) internal pure returns (bytes32) {
    uint256 subdata = 0;
    for (uint256 i = 0; i < 32; i++) {
      subdata += uint256(data[31 + pos - i]) << 8*i;
    }
    return bytes32(subdata);
  }


}
