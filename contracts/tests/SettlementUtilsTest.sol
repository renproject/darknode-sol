pragma solidity ^0.4.24;

import "../SettlementUtils.sol";

contract SettlementUtilsTest {

    mapping(bytes32 => SettlementUtils.OrderDetails) public orderDetails;

    function submitOrder(
        uint32 settlementID,
        uint8 parity,
        uint8 orderType,
        uint64 expiry,
        uint64 tokens,
        uint256 price,
        uint256 volume,
        uint256 minimumVolume,
        uint256 nonceHash
    ) public {
        SettlementUtils.OrderDetails memory order = SettlementUtils.OrderDetails({
            orderType: orderType,
            parity: parity,
            settlementID: settlementID,
            expiry: expiry,
            tokens: tokens,
            price: price,
            volume: volume,
            minimumVolume: minimumVolume,
            nonceHash: nonceHash
        });

        bytes32 orderID = SettlementUtils.hashOrder(order);
        orderDetails[orderID] = order;
    }

    function hashOrder(
        uint32 settlementID,
        uint8 parity,
        uint8 orderType,
        uint64 expiry,
        uint64 tokens,
        uint256 price,
        uint256 volume,
        uint256 minimumVolume,
        uint256 nonceHash
    ) public pure returns (bytes32) {
        SettlementUtils.OrderDetails memory order = SettlementUtils.OrderDetails({
            orderType: orderType,
            parity: parity,
            settlementID: settlementID,
            expiry: expiry,
            tokens: tokens,
            price: price,
            volume: volume,
            minimumVolume: minimumVolume,
            nonceHash: nonceHash
        });
        return SettlementUtils.hashOrder(order);
    }

    function verifyMatch(bytes32 _buyID, bytes32 _sellID) public view returns (bool) {
        return SettlementUtils.verifyMatch(orderDetails[_buyID], orderDetails[_sellID]);
    }
}
