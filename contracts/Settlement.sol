pragma solidity ^0.4.24;

/// @notice The Settlement interface defines the functions that a settlement
/// layer must implement.
/// Docs: https://github.com/republicprotocol/republic-sol/blob/nightly/docs/05-settlement.md
interface Settlement {
    function submitOrder(
        bytes _details,
        uint64 _settlementID,
        uint64 _tokens,
        uint256 _price,
        uint256 _volume,
        uint256 _minimumVolume
    ) external;

    function submitOrderGasPriceLimit() external view returns (uint256);

    function settle(
        bytes32 _buyID,
        bytes32 _sellID
    ) external;
}