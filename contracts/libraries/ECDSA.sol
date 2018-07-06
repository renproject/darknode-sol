pragma solidity ^0.4.24;

import "./Utils.sol";

library ECDSA {
    /**
     * @notice Retrieves the address from a signature
     *
     * @param _hash the message that was signed (any length of bytes)
     * @param _signature the signature (65 bytes)
     */
    function addr(bytes _hash, bytes _signature) internal pure returns (address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n";
        bytes memory encoded = abi.encodePacked(prefix, Utils.uintToBytes(_hash.length), _hash);
        bytes32 prefixedHash = keccak256(encoded);

        // v is expected to be 27 or 28 but some libraries use 0 and 1 instead
        uint8 v = uint8(_signature[64]);
        if (v == 0 || v == 1) {
            v = v + 27;
        }
        return ecrecover(prefixedHash, v, Utils.toBytes32(_signature, 0), Utils.toBytes32(_signature, 32));
    }
}