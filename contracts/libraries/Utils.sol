pragma solidity ^0.4.24;

library Utils {

    function toBytes32(bytes data, uint pos) internal pure returns (bytes32) {
        uint256 subdata = 0;
        for (uint256 i = 0; i < 32; i++) {
            subdata += uint256(data[31 + pos - i]) << 8*i;
        }
        return bytes32(subdata);
    }

    function toBytesI(bytes data, uint length) internal pure returns (bytes) {
        bytes memory result = new bytes(length);
        for (uint i = 0; i < length; i++) {
            result[i] = data[i];
        }
        return result;
    }

    // /**
    // * @notice Create a new bytes array containing the last n bytes of the input.
    // *
    // * @param _bs The input bytes.
    // * @param _n The number of bytes that will be taken from the end of the input
    // *        bytes.
    // *
    // * @return The last n bytes of the input bytes.
    // */
    // function lastNBytes(bytes _bs, uint _n) internal pure returns (bytes out) {
    //     assert(_bs.length >= _n);
    //     out = new bytes(_n);
    //     uint offset = _bs.length - _n;
    //     for (uint i = 0; i < _n; i++) {
    //         out[i] = _bs[offset + i];
    //     }
    //     return out;
    // }

    // /**
    // * @notice Generate an Ethereum address from an ECDSA public key. An Ethereum
    // * public key is 65 bytes (1 byte 0x04, 32 bytes x value, 32 bytes y value).
    // * The address is taken from only the last 64 bytes.
    // *
    // * @param _publicKey The public key.
    // *
    // * @return An Ethereum address.
    // */
    // function ethereumAddressFromPublicKey(bytes _publicKey) public pure returns (address) {
    //     return address(keccak256(lastNBytes(_publicKey, 64)));
    // }

    // /**
    // * @notice Generate a Republic ID from an ECDSA public key. It is generated
    // * by taking the first 20 bytes of the keccak256 hash of the public key.
    // *
    // * @param _publicKey The public key.
    // *
    // * @return A Republic ID.
    // */
    // function republicIDFromPublicKey(bytes _publicKey) public pure returns (bytes20) {
    //     return bytes20(uint(keccak256(_publicKey)) >> (8 * 12));
    // }

}
