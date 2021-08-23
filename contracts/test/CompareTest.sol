pragma solidity 0.5.17;

import {Compare} from "../libraries/Compare.sol";

/// @dev CompareTest exposes the internal functions of Compare.sol.
contract CompareTest {
    function bytesEqual(bytes memory a, bytes memory b)
        public
        pure
        returns (bool)
    {
        return Compare.bytesEqual(a, b);
    }
}
