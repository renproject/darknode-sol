pragma solidity ^0.5.2;

import "../libraries/Compare.sol";

/// @dev CompareTest exposes the internal functions of Compare.sol
library CompareTest {

    function bytesEqual(bytes memory a, bytes memory b) public pure returns (bool) {
        return Compare.bytesEqual(a, b);
    }
}
