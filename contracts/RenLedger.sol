pragma solidity ^0.4.23;

import "./DarknodeRegistry.sol";
import "./libraries/ECDSA.sol";

contract RenLedger {

    enum OrderType {Midpoint, Limit}
    enum OrderParity {Buy, Sell}
    enum OrderState {Undefined, Open, Confirmed, Canceled}

    bytes32[] public orderbook;

    mapping(bytes32 => OrderState) private orderStates;
    mapping(bytes32 => bytes32[]) private orderMatches;
    mapping(bytes32 => uint256) private orderPriorities;
    mapping(bytes32 => address) private orderTraders;
    mapping(bytes32 => address) private orderBrokers;
    mapping(bytes32 => address) private orderConfirmers;

    uint256 public fee;
    DarknodeRegistry private darknodeRegistry;
    RepublicToken private ren;

    modifier onlyDarknode(address _sender) {
        require(darknodeRegistry.isRegistered(bytes20(_sender)));
        _;
    }

    constructor(uint256 _fee, address _republicTokenAddress, address _darknodeRegistryAddress) public {
        fee = _fee;
        darknodeRegistry = DarknodeRegistry(_darknodeRegistryAddress);
        ren = RepublicToken(_republicTokenAddress);
    }

    function openOrder(bytes _signature, bytes32 _orderId) public {
        require(ren.allowance(msg.sender, this) >= fee);
        require(ren.transferFrom(msg.sender, this, fee));
        require(orderStates[_orderId] == OrderState.Undefined);

        orderbook.push(_orderId);
        orderStates[_orderId] = OrderState.Open;
        orderPriorities[_orderId] = orderbook.length;

        // The trader address should be recovered from a message in the
        // form "Republic Protocol: open: {orderId}"
        bytes32 data = keccak256("Republic Protocol: open: ", _orderId);
        address trader = ECDSA.addr(data, _signature);
        orderTraders[_orderId] = trader;
        orderBrokers[_orderId] = msg.sender;
    }

    function confirmOrder(bytes32 _orderId, bytes32[] _orderMatches) public onlyDarknode(msg.sender) {
        require(orderStates[_orderId] == OrderState.Open);
        for (uint256 i = 0; i < _orderMatches.length; i++) {
            require(orderStates[_orderMatches[i]] == OrderState.Open);
        }

        orderStates[_orderId] = OrderState.Confirmed;
        for (i = 0; i < _orderMatches.length; i++) {
            orderStates[_orderMatches[i]] = OrderState.Confirmed;
            orderMatches[_orderMatches[i]] = [_orderId];
        }
        orderConfirmers[_orderId] = msg.sender;
        orderMatches[_orderId] = _orderMatches;
    }

    // The trader address should be recovered from a message in the
    // form "Republic Protocol: cancel: {orderId}" and should match the address
    // already stored against that order
    function cancelOrder(bytes _signature, bytes32 _orderId) public {
        require(orderStates[_orderId] == OrderState.Open);
        bytes32 data = keccak256("Republic Protocol: cancel: ", _orderId);
        address trader = ECDSA.addr(data, _signature);
        require(orderTraders[_orderId] == trader);
        orderStates[_orderId] = OrderState.Canceled;
    }

    function order(uint256 index) public view returns (bytes32, bool){
        if (index > orderbook.length){
            return ("", false);
        }

        return (orderbook[index], true);
    }

    function orderState(bytes32 _orderId) public view returns (uint8){
        return uint8(orderStates[_orderId]);
    }

    function orderMatch(bytes32 _orderId) public view returns (bytes32[]){
        return orderMatches[_orderId];
    }

    function orderPriority(bytes32 _orderId) public view returns (uint256){
        return orderPriorities[_orderId];
    }

    function orderTrader(bytes32 _orderId) public view returns (address){
        return orderTraders[_orderId];
    }

    function orderBroker(bytes32 _orderId) public view returns (address){
        return orderBrokers[_orderId];
    }

    function orderConfirmer(bytes32 _orderId) public view returns (address){
        return orderConfirmers[_orderId];
    }
}

