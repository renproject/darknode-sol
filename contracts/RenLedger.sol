pragma solidity ^0.4.24;

import "./DarknodeRegistry.sol";
import "./libraries/ECDSA.sol";

/**
 * @notice RenLedger is responsible for storing the orders and their priorities.
 * It's used as an consensus of which order should be executed.
 */
contract RenLedger {

    enum OrderType {Midpoint, Limit}
    enum OrderParity {Buy, Sell}
    enum OrderState {Undefined, Open, Confirmed, Canceled}

    // orderbook stores all the orders in a big list in the order of added time
    bytes32[] public orderbook;

    // we use several maps to store data of each order.
    mapping(bytes32 => OrderState) private orderStates;
    mapping(bytes32 => bytes32[]) private orderMatches;
    mapping(bytes32 => uint256) private orderPriorities;
    mapping(bytes32 => address) private orderTraders;
    mapping(bytes32 => address) private orderBrokers;
    mapping(bytes32 => address) private orderConfirmers;

    uint256 public fee;
    // Republic ERC20 token contract is used to transfer bonds.
    RepublicToken private ren;
    // DarknodeRegistry is used to check registration of the order confirmer.
    DarknodeRegistry private darknodeRegistry;

    /**
    * @notice Only allow registered dark nodes.
    */
    modifier onlyDarknode(address _sender) {
        require(darknodeRegistry.isRegistered(bytes20(_sender)));
        _;
    }

    /**
     * @notice The RenLedger constructor.
     *
     * @param _fee The fee rate of opening an order.
     * @param _token The address of the RepublicToken contract.
     * @param _registry The address of the darknodeRegistry contract.
     */
    constructor(uint256 _fee, address _token, address _registry) public {
        fee = _fee;
        ren = RepublicToken(_token);
        darknodeRegistry = DarknodeRegistry(_registry);
    }

    /**
     * @notice openOrder opens a new order in the ledger. It requires certain allowance of
     *         REN as opening fee. It will recover and store the the trader address from the
     *         signature.
     *
     * @param _signature  Signature of the message "Republic Protocol: open: {orderId}"
     * @param _orderId Order id.
     */
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

    /**
     * @notice confirmOrder confirms a match is found between one order and a list of orders.
     *         It requires the  sender address to be registered in the darknodeRegistry,
     *
     * @param _orderId Order ID .
     * @param _orderMatches A list of matched order
     */
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

    /**
     * @notice cancelOrder cancels a opened order in the ledger. It will recover and store the the
               trader address from the signature.
     *
     * @param _signature  Signature of the message "Republic Protocol: cancel: {orderId}"
     * @param _orderId Order id.
     */
    function cancelOrder(bytes _signature, bytes32 _orderId) public {
        require(orderStates[_orderId] == OrderState.Open);
        bytes32 data = keccak256("Republic Protocol: cancel: ", _orderId);
        address trader = ECDSA.addr(data, _signature);
        require(orderTraders[_orderId] == trader);
        orderStates[_orderId] = OrderState.Canceled;
    }

    /**
    * Order will return orderId in the given index and true if exists.
    * Otherwise it will return empty bytes and false.
    */
    function order(uint256 index) public view returns (bytes32, bool){
        if (index > orderbook.length) {
            return ("", false);
        }

        return (orderbook[index], true);
    }

    /**
    * orderState will return status of the given orderID.
    */
    function orderState(bytes32 _orderId) public view returns (uint8){
        return uint8(orderStates[_orderId]);
    }

    /**
    * orderMatch will return a list of matched orders to the given orderID.
    */
    function orderMatch(bytes32 _orderId) public view returns (bytes32[]){
        return orderMatches[_orderId];
    }

    /**
    * orderPriority will return the priority of the given orderID.
    * The priority is the index of the order in the orderbook plus one.
    */
    function orderPriority(bytes32 _orderId) public view returns (uint256){
        return orderPriorities[_orderId];
    }

    /**
    * orderTrader will return the trader of the given orderID.
    * Trader is the one who signs the message and does the actual trading.
    */
    function orderTrader(bytes32 _orderId) public view returns (address){
        return orderTraders[_orderId];
    }

    /**
    * orderBroker will return the broker of the given orderID.
    * Broker is the one who represent the trader to send the tx.
    */
    function orderBroker(bytes32 _orderId) public view returns (address){
        return orderBrokers[_orderId];
    }

    /**
    * orderConfirmer will return the darknode address which confirms the given orderID.
    */
    function orderConfirmer(bytes32 _orderId) public view returns (address){
        return orderConfirmers[_orderId];
    }
}

