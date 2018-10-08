pragma solidity ^0.4.25;

/// @notice DisapprovingBroker implements the BrokerVerifier interface, always
/// rejecting signatures.
contract DisapprovingBroker {
    event Verified(address _trader, bytes _signature, bytes32 _orderID);

    function verifyOpenSignature(
        address _trader,
        bytes _signature,
        bytes32 _orderID
    ) external returns (bool) {
        // Log emitted to easily avoid linters from complaining about the unused
        // parameters
        emit Verified(_trader, _signature, _orderID);
        return false;
    }
}