pragma solidity ^0.4.24;

import "../DarknodeRegistry.sol";
import "../SettlementRegistry.sol";

interface Orderbook {

    enum OrderState {Undefined, Open, Confirmed, Canceled}

    function updateDarknodeRegistry(DarknodeRegistry _newDarknodeRegistry) external;

    function updateSettlementRegistry(SettlementRegistry _newSettlementRegistry) external;

    function openBuyOrder(uint64 _settlementID, bytes _signature, bytes32 _orderID, uint32 _orderType, uint64 _expiration) external;

    function openSellOrder(uint64 _settlementID, bytes _signature, bytes32 _orderID, uint32 _orderType, uint64 _expiration) external;

    function confirmOrder(bytes32 _orderID, bytes32 _matchedOrderID) external;

    function cancelOrder(bytes32 _orderID) external;

    function orderState(bytes32 _orderID) external view returns (OrderState);

    function orderMatch(bytes32 _orderID) external view returns (bytes32);

    function orderTrader(bytes32 _orderID) external view returns (address);

    function orderConfirmer(bytes32 _orderID) external view returns (address);

    function orderType(bytes32 _orderID) external view returns (uint32);

    function ordersCount() external view returns (uint256);

    function getBuyOrders(uint256 _offset, uint256 _limit) external view returns (bytes32[], address[], uint8[]);

    function getSellOrders(uint256 _offset, uint256 _limit) external view returns (bytes32[], address[], uint8[]);
}
