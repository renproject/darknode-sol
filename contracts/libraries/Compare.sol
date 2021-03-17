pragma solidity 0.5.17;

library Compare {
    function bytesEqual(bytes memory a, bytes memory b)
        internal
        pure
        returns (bool)
    {
        if (a.length != b.length) {
            return false;
        }
        for (uint256 i = 0; i < a.length; i++) {
            if (a[i] != b[i]) {
                return false;
            }
        }
        return true;
    }
}
