pragma solidity 0.5.17;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";

contract TrueSignerVerifier {
    using ECDSA for bytes32;

    constructor() public {}

    /// @notice verifySignature checks the the provided signature matches the
    /// provided parameters. Returns a 4-byte value as defined by ERC1271.
    function isValidSignature(bytes32 sigHash, bytes calldata signature) external view returns (bytes4) {
        return bytes4(0x1626ba7e);
    }
}

contract FalseSignerVerifier {
    using ECDSA for bytes32;

    constructor() public {}

    /// @notice verifySignature checks the the provided signature matches the
    /// provided parameters. Returns a 4-byte value as defined by ERC1271.
    function isValidSignature(bytes32 sigHash, bytes calldata signature) external view returns (bytes4) {
        return bytes4(0x00000000);
    }
}