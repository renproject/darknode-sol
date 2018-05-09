pragma solidity ^0.4.0;

import "./DarknodeRegistry.sol";

contract RenLedger {

    enum OrderType { Midpoint, Limit }
    enum OrderParity { Buy, Sell }
    enum OrderState { Undefined, Open, Confirmed, Canceled }

    struct Order {
        OrderType ty;
        OrderParity parity;
        uint256 expiry;
    }

    bytes32[] public orderbook;

    mapping(bytes32 => Order) public orders;
    mapping(bytes32 => OrderState) public orderStates;
    mapping(bytes32 => bytes32[]) public orderMatches;
    mapping(bytes32 => uint256) public orderPriorities;
    mapping(bytes32 => address) public orderTraders;
    mapping(bytes32 => address) public orderBrokers;
    mapping(bytes32 => address) public orderConfirmer;

    DarknodeRegistry public darknodeRegistry;

    constructor(address _darknodeRegistryAddress) public {
        orderbook = new bytes32[](0);
        darknodeRegistry = DarknodeRegistry(_darknodeRegistryAddress);
    }

    // FIXME: Require the transfer of REN
    function openOrder(bytes32 _orderId, uint8 _v, bytes32 _r, bytes32 _s) public {
        require(orderStates[_orderId] == OrderState.Undefined);

        orderbook.push(_orderId);
        orderStates[_orderId] = OrderState.Open;
        orderPriorities[_orderId] = orderbook.length;

        // FIXME: The trader address should be recovered from a message in the
        // form "Republic Protocol: open: {orderId}"
        orderTraders[_orderId] = ecrecover(_orderId, _v, _r, _s);
        orderBrokers[_orderId] = msg.sender;
    }

    // FIXME: Check that the sender is a registered Darknode
    function confirmOrder(bytes32 _orderId, bytes32[] _orderMatches) public {
        require(orderStates[_orderId] == OrderState.Open);
        for (uint256 i = 0; i < _orderMatches.length; i++) {
            require(orderStates[_orderMatches[i]] == OrderState.Open);
        }

        orderStates[_orderId] = OrderState.Confirmed;
        for (i = 0; i < _orderMatches.length; i++) {
            orderStates[_orderMatches[i]] = OrderState.Confirmed;
        }
        orderConfirmer[_orderId] = msg.sender;
    }

    // FIXME: The trader address should be recovered from a message in the
    // form "Republic Protocol: cancel: {orderId}" and should match the address
    // already stored against that order
    function cancelOrder(bytes32 _orderId, uint8 _v, bytes32 _r, bytes32 _s) public {
        require(orderStates[_orderId] == OrderState.Open);

        orderStates[_orderId] = OrderState.Canceled;
    }
}
