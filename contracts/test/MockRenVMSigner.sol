pragma solidity 0.5.17;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";

contract MockRenVMSigner {
    using ECDSA for bytes32;

    address signer;

    constructor(address _signer) public {
        signer = _signer;
    }

    /// @notice verifySignature checks the the provided signature matches the
    /// provided parameters. Returns a 4-byte value as defined by ERC1271.
    function isValidSignature(bytes32 sigHash, bytes calldata signature) external view returns (bytes4) {
        require(signer != address(0x0), "SignatureVerifier: mintAuthority not initialized");
        return signer == ECDSA.recover(sigHash, signature) ? bytes4(0x1626ba7e) : bytes4(0x00000000);
    }
}