pragma solidity ^0.4.24;

import "../SettlementUtils.sol";

contract SettlementUtilsTest {

    uint32 constant public SETTLEMENT_IDENTIFIER = 1;

    mapping(bytes32 => SettlementUtils.OrderDetails) public orderDetails;

    function submitOrder(
        uint8 _orderType,
        uint8 _parity,
        uint64 _expiry,
        uint64 _tokens,
        uint16 _priceC, uint16 _priceQ,
        uint16 _volumeC, uint16 _volumeQ,
        uint16 _minimumVolumeC, uint16 _minimumVolumeQ,
        uint256 _nonceHash
    ) public {
        SettlementUtils.OrderDetails memory order = SettlementUtils.OrderDetails({
            orderType: _orderType,
            parity: _parity,
            expiry: _expiry,
            tokens: _tokens,
            priceC: _priceC, priceQ: _priceQ,
            volumeC: _volumeC, volumeQ: _volumeQ,
            minimumVolumeC: _minimumVolumeC, minimumVolumeQ: _minimumVolumeQ,
            nonceHash: _nonceHash
        });

        bytes32 orderID = SettlementUtils.hashOrder(order, SETTLEMENT_IDENTIFIER);

        orderDetails[orderID] = order;
    }

    function verifyOrder(bytes32 _orderID) public view {
        SettlementUtils.verifyOrder(orderDetails[_orderID]);
    }

    function verifyMatch(bytes32 _buyID, bytes32 _sellID) public view {
        SettlementUtils.verifyMatch(orderDetails[_buyID], orderDetails[_sellID]);
    }

    function tupleToPrice(uint256 priceC, int256 priceQ, uint256 decimals) public pure returns (uint256) {
        return SettlementUtils.tupleToPrice(priceC, priceQ, decimals);
    }
}
