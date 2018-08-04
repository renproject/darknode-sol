pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ECRecovery.sol";

library Utils {

    /**
     * @notice Converts a number to its string/bytes representation
     *
     * @param _v the uint to convert
     */
    function uintToBytes(uint256 _v) internal pure returns (bytes) {
        uint256 v = _v;
        if (v == 0) {
            return "0";
        }

        uint256 digits = 0;
        uint256 v2 = v;
        while (v2 > 0) {
            v2 /= 10;
            digits++;
        }

        bytes memory result = new bytes(digits);

        for (uint256 i = 0; i < digits; i++) {
            result[digits - i - 1] = bytes1((v % 10) + 48);
            v /= 10;
        }

        return result;
    }

    /**
     * @notice Retrieves the address from a signature
     *
     * @param _hash the message that was signed (any length of bytes)
     * @param _signature the signature (65 bytes)
     */
    function addr(bytes _hash, bytes _signature) internal pure returns (address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n";
        bytes memory encoded = abi.encodePacked(prefix, uintToBytes(_hash.length), _hash);
        bytes32 prefixedHash = keccak256(encoded);

        return ECRecovery.recover(prefixedHash, _signature);
    }

}
