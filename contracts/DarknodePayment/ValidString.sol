// SPDX-License-Identifier: MIT

pragma solidity 0.5.17;

library ValidString {
    function isAlphanumeric(string memory _string) public pure returns (bool) {
        for (uint256 i = 0; i < bytes(_string).length; i++) {
            uint8 char = uint8(bytes(_string)[i]);
            if (
                !((char >= 65 && char <= 90) ||
                    (char >= 97 && char <= 122) ||
                    (char >= 48 && char <= 57))
            ) {
                return false;
            }
        }
        return true;
    }

    function isNotEmpty(string memory _string) public pure returns (bool) {
        return bytes(_string).length > 0;
    }
}
