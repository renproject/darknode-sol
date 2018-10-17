pragma solidity ^0.4.24;

import "../libraries/SettlementUtils.sol";

/// @notice A contract that exposes the SettlementUtils functions for testing.
contract SettlementUtilsTest {

    mapping(bytes32 => SettlementUtils.OrderDetails) public orderDetails;

    function submitOrder(
        bytes details,
        uint64 settlementID,
        uint64 tokens,
        uint256 price,
        uint256 volume,
        uint256 minimumVolume
    ) public {
        SettlementUtils.OrderDetails memory order = SettlementUtils.OrderDetails({
            settlementID: settlementID,
            tokens: tokens,
            price: price,
            volume: volume,
            minimumVolume: minimumVolume
        });
        bytes32 orderID = SettlementUtils.hashOrder(details, order);
        orderDetails[orderID] = order;
    }

    function hashOrder(
        bytes details,
        uint64 settlementID,
        uint64 tokens,
        uint256 price,
        uint256 volume,
        uint256 minimumVolume
    ) public pure returns (bytes32) {
        SettlementUtils.OrderDetails memory order = SettlementUtils.OrderDetails({
            settlementID: settlementID,
            tokens: tokens,
            price: price,
            volume: volume,
            minimumVolume: minimumVolume
        });
        return SettlementUtils.hashOrder(details, order);
    }

    function verifyMatchDetails(bytes32 _buyID, bytes32 _sellID) public view returns (bool) {
        return SettlementUtils.verifyMatchDetails(orderDetails[_buyID], orderDetails[_sellID]);
    }
}
