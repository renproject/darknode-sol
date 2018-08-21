pragma solidity ^0.4.24;

/// @notice The BrokerVerifier interface defines the functions that a settlement
/// layer's broker verifier contract must implement.
interface BrokerVerifier {
    function verifyOpenSignature(
        address _trader,
        bytes _signature,
        bytes32 _orderID
    ) external returns (bool);
}