pragma solidity ^0.4.24;

interface Settlement {
    function submitOrder(
        uint8 _orderType,
        uint8 _parity,
        uint64 _expiry,
        uint64 _tokens,
        uint16 _priceC, uint16 _priceQ,
        uint16 _volumeC, uint16 _volumeQ,
        uint16 _minimumVolumeC, uint16 _minimumVolumeQ,
        uint256 _nonceHash
        ) external;

    function submitMatch(
        bytes32 _buyID,
        bytes32 _sellID
        ) external;

    function getSettlementDetails(
        bytes32 _buyID,
        bytes32 _sellID
        ) external view returns (
            uint256 midPrice,
            uint256 lowTokenValue,
            uint256 highTokenValue,
            uint256 lowTokenFee,
            uint256 highTokenFee
        );
}