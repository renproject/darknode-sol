pragma solidity ^0.4.24;

import "./Utils.sol";

library ECDSA {

    /**
     * @notice Converts a number to its string/bytes representation
     *
     * @param _v the uint to convert
     */
    function uintToBytes(uint _v) public pure returns (bytes) {
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

        // v is expected to be 27 or 28 but some libraries use 0 and 1 instead
        uint8 v = uint8(_signature[64]);
        if (v == 0 || v == 1) {
            v = v + 27;
        }
        return ecrecover(prefixedHash, v, Utils.toBytes32(_signature, 0), Utils.toBytes32(_signature, 32));
    }
}