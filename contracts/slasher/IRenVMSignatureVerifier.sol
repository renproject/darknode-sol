pragma solidity 0.5.17;

interface IRenVMSignatureVerifier {
    function isValidSignature(bytes32 sigHash, bytes calldata signature)
        external
        view
        returns (bytes4);
}
