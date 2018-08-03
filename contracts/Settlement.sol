pragma solidity ^0.4.24;

/// @notice The Settlement interface defines the functions that a settlement
/// layer must implement
interface Settlement {
    function submitOrder(
        bytes _details,
        uint64 _settlementID,
        uint64 _tokens,
        uint256 _price,
        uint256 _volume, 
        uint256 _minimumVolume
        ) external;

    function submitMatch(
        bytes32 _buyID,
        bytes32 _sellID
        ) external;
    
    function confirmer(
        bytes32 _buyID,
        bytes32 _sellID
        ) external;
}