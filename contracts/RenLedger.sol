pragma solidity ^0.4.23;

import "./DarknodeRegistry.sol";
import "./libraries/ECDSA.sol";

contract RenLedger {

    enum OrderType {Midpoint, Limit}
    enum OrderParity {Buy, Sell}
    enum OrderState {Undefined, Open, Confirmed, Canceled}

    struct Order {
        OrderType ty;
        OrderParity parity;
        uint256 expiry;
    }

    bytes32[] public orderbook;

    // todo : where do we use this ?
    mapping(bytes32 => Order) public orders;
    mapping(bytes32 => OrderState) public orderStates;
    mapping(bytes32 => bytes32[]) public orderMatches;
    mapping(bytes32 => uint256) public orderPriorities;
    mapping(bytes32 => address) public orderTraders;
    mapping(bytes32 => address) public orderBrokers;
    mapping(bytes32 => address) public orderConfirmer;

    DarknodeRegistry public darknodeRegistry;
    RepublicToken ren;

    modifier onlyDarknode(address sender) {
        require(darknodeRegistry.isRegistered(bytes20(sender)));
        _;
    }

    constructor(address _republicTokenAddress, address _darknodeRegistryAddress) public {
        orderbook = new bytes32[](0);
        darknodeRegistry = DarknodeRegistry(_darknodeRegistryAddress);
        ren = RepublicToken(_republicTokenAddress);
    }

    function openOrder(bytes32 _orderId, bytes signature) public {
        // TODO : The fees model will be implemented later
        require(ren.allowance(msg.sender, this) >= 1);
        require(ren.transferFrom(msg.sender, this, 1));
        require(orderStates[_orderId] == OrderState.Undefined);

        orderbook.push(_orderId);
        orderStates[_orderId] = OrderState.Open;
        orderPriorities[_orderId] = orderbook.length;

        // The trader address should be recovered from a message in the
        // form "Republic Protocol: open: {orderId}"
        bytes32 hash = keccak256("Republic Protocol: open: ", _orderId);
        address trader = ECDSA.addr(hash, signature);
        orderTraders[_orderId] = trader;
        orderBrokers[_orderId] = msg.sender;
    }

    function confirmOrder(bytes32 _orderId, bytes32[] _orderMatches) public onlyDarknode(msg.sender) {
        require(orderStates[_orderId] == OrderState.Open);
        for (uint256 i = 0; i < _orderMatches.length; i++)
        {
            require(orderStates[_orderMatches[i]] == OrderState.Open);
        }

        orderStates[_orderId] = OrderState.Confirmed;
        for (i = 0; i < _orderMatches.length; i++) {
            orderStates[_orderMatches[i]] = OrderState.Confirmed;
        }
        orderConfirmer[_orderId] = msg.sender;
    }

    // The trader address should be recovered from a message in the
    // form "Republic Protocol: cancel: {orderId}" and should match the address
    // already stored against that order
    function cancelOrder(bytes32 _orderId, bytes signature) public {
        require(orderStates[_orderId] == OrderState.Open);
        bytes32 hash = keccak256("Republic Protocol: cancel: ", _orderId);
        address trader = ECDSA.addr(hash, signature);
        require(orderTraders[_orderId] == trader);
        orderStates[_orderId] = OrderState.Canceled;
    }
}
