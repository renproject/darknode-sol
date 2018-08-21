pragma solidity ^0.4.24;

/// @notice DisapprovingBroker implements the BrokerVerifier interface, always
/// rejecting signatures.
contract DisapprovingBroker {
    function verifyOpenSignature(
        address _trader,
        bytes _signature,
        bytes32 _orderID
    ) external pure returns (bool) {
        return false;
    }
}