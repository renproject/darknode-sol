pragma solidity ^0.5.2;

import "../libraries/String.sol";

/// @dev StringTest exposes the internal functions of String.sol
library StringTest {

    function fromBytes32(bytes32 _value) public pure returns(string memory) {
        return String.fromBytes32(_value);
    }

    function fromAddress(address _addr) public pure returns(string memory) {
        return String.fromAddress(_addr);
    }

    function add4(string memory a, string memory b, string memory c, string memory d) public pure returns (string memory) {
        return String.add4(a, b, c, d);
    }
}
