pragma solidity ^0.4.24;

/// @notice The BrokerVerifier interface defines the functions that a settlement
/// layer's broker verifier contract must implement.
interface BrokerVerifier {

    /// @notice The function signature that will be called when a trader opens
    /// an order.
    ///
    /// @param _trader The trader requesting the withdrawal.
    /// @param _signature The 65-byte signature from the broker.
    /// @param _orderID The 32-byte order ID.
    function verifyOpenSignature(
        address _trader,
        bytes _signature,
        bytes32 _orderID
    ) external returns (bool);
}