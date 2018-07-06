pragma solidity ^0.4.24;

import "../libraries/Utils.sol";

contract UtilsTest {
    function uintToBytes(uint _v) public pure returns (bytes) {
        return Utils.uintToBytes(_v);
    }
}
