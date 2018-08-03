pragma solidity ^0.4.24;

library Utils {

    /**
     * @notice Converts a number to its string/bytes representation
     *
     * @param _v the uint to convert
     */
    function uintToBytes(uint _v) internal pure returns (bytes) {
        uint v = _v;
        if (v == 0) {
            return "0";
        }

        uint digits = 0;
        uint v2 = v;
        while (v2 > 0) {
            v2 /= 10;
            digits++;
        }

        bytes memory result = new bytes(digits);

        for (uint i = 0; i < digits; i++) {
            result[digits - i - 1] = bytes1((v % 10) + 48);
            v /= 10;
        }

        return result;
    }

    function toBytes32(bytes data, uint pos) internal pure returns (bytes32) {
        uint256 subdata = 0;
        for (uint256 i = 0; i < 32; i++) {
            subdata += uint256(data[31 + pos - i]) << 8*i;
        }
        return bytes32(subdata);
    }

}
