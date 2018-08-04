pragma solidity ^0.4.24;

import "../libraries/Utils.sol";

/// @notice A contract that exposes Utils.sol's functions for testing.
contract UtilsTest {
    function uintToBytes(uint256 _v) public pure returns (bytes) {
        return Utils.uintToBytes(_v);
    }

    function addr(bytes data, bytes sig) public pure returns (address) {
        return Utils.addr(data, sig);
    }
}
