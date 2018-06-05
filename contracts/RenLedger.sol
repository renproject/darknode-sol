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

    /**
    * @notice Order stores the relevant data of an order.
    */
    struct Order {
        OrderParity parity;
        OrderState state;
        address trader;
        address broker;
        address confirmer;
        uint256 priority;
        uint256 blockNumber;
        bytes32[] matches;
    }

    // buyOrders/sellOrders store all the buy/sell orders in a list .
    bytes32[] public buyOrders;
    bytes32[] public sellOrders;
    bytes32[] orderbook;

    mapping(bytes32 => Order) private orders;

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
     * @notice openBuyOrder opens a new buy order in the ledger. The order must not be opened.
     *         It requires certain allowance of REN as opening fee. It will recover and store
     *         the the trader address from the signature.
     *
     * @param _signature  Signature of the message "Republic Protocol: open: {orderId}"
     * @param _orderId Order id or the buy order.
     */
    function openBuyOrder(bytes _signature, bytes32 _orderId) public {
        openOrder(_signature, _orderId);
        buyOrders.push(_orderId);
        orders[_orderId].priority = buyOrders.length;
    }

    /**
     * @notice openSellOrder opens a new sell order in the ledger. The order must not be opened.
     *         It requires certain allowance of REN as opening fee. It will recover and store
     *         the the trader address from the signature.
     *
     * @param _signature  Signature of the message "Republic Protocol: open: {orderId}"
     * @param _orderId Order id or the buy order.
     */
    function openSellOrder(bytes _signature, bytes32 _orderId) public {
        openOrder(_signature, _orderId);
        sellOrders.push(_orderId);
        orders[_orderId].priority = buyOrders.length;
    }

    function openOrder(bytes _signature, bytes32 _orderId) private {
        require(ren.allowance(msg.sender, this) >= fee);
        require(ren.transferFrom(msg.sender, this, fee));
        require(orders[_orderId].state == OrderState.Undefined);

        // recover trader address from the signature
        bytes32 data = keccak256(abi.encodePacked("Republic Protocol: open: ", _orderId));
        address trader = ECDSA.addr(data, _signature);
        orders[_orderId].state = OrderState.Open;
        orders[_orderId].trader = trader;
        orders[_orderId].broker = msg.sender;
        orders[_orderId].blockNumber = block.number;
        orderbook.push(_orderId);
    }

    /**
     * @notice confirmOrder confirms a match is found between one order and a list of orders.
     *         It requires the  sender address to be registered in the darknodeRegistry,
     *
     * @param _orderId Order ID .
     * @param _orderMatches A list of matched order
     */
    function confirmOrder(bytes32 _orderId, bytes32[] _orderMatches) public onlyDarknode(msg.sender) {
        require(orders[_orderId].state == OrderState.Open);
        for (uint256 i = 0; i < _orderMatches.length; i++) {
            require(orders[_orderMatches[i]].state == OrderState.Open);
        }

        for (i = 0; i < _orderMatches.length; i++) {
            orders[_orderMatches[i]].state = OrderState.Confirmed;
            orders[_orderMatches[i]].matches = [_orderId];
        }
        orders[_orderId].state = OrderState.Confirmed;
        orders[_orderId].confirmer = msg.sender;
        orders[_orderId].matches = _orderMatches;
    }

    /**
     * @notice cancelOrder cancels a opened order in the ledger. It will recover and store the the
               trader address from the signature.
     *
     * @param _signature  Signature of the message "Republic Protocol: cancel: {orderId}"
     * @param _orderId Order id.
     */
    function cancelOrder(bytes _signature, bytes32 _orderId) public {
        require(orders[_orderId].state == OrderState.Open);

        // recover trader address from the signature
        bytes32 data = keccak256(abi.encodePacked("Republic Protocol: cancel: ", _orderId));
        address trader = ECDSA.addr(data, _signature);
        require(orders[_orderId].trader == trader);
        orders[_orderId].state = OrderState.Canceled;
    }

    /**
    * buyOrder will return orderId of the given index in buy order list and true if exists.
    * Otherwise it will return empty bytes and false.
    */
    function buyOrder(uint256 index) public view returns (bytes32, bool){
        if (index >= buyOrders.length) {
            return ("", false);
        }

        return (buyOrders[index], true);
    }

    /**
    * sellOrder will return orderId of the given index in sell order list and true if exists.
    * Otherwise it will return empty bytes and false.
    */
    function sellOrder(uint256 index) public view returns (bytes32, bool){
        if (index >= sellOrders.length) {
            return ("", false);
        }

        return (sellOrders[index], true);
    }

    /**
    * orderState will return status of the given orderID.
    */
    function orderState(bytes32 _orderId) public view returns (uint8){
        return uint8(orders[_orderId].state);
    }

    /**
    * orderMatch will return a list of matched orders to the given orderID.
    */
    function orderMatch(bytes32 _orderId) public view returns (bytes32[]){
        return orders[_orderId].matches;
    }

    /**
    * orderPriority will return the priority of the given orderID.
    * The priority is the index of the order in the orderbook.
    */
    function orderPriority(bytes32 _orderId) public view returns (uint256){
        return orders[_orderId].priority;
    }

    /**
    * orderTrader will return the trader of the given orderID.
    * Trader is the one who signs the message and does the actual trading.
    */
    function orderTrader(bytes32 _orderId) public view returns (address){
        return orders[_orderId].trader;
    }

    /**
    * orderBroker will return the broker of the given orderID.
    * Broker is the one who represent the trader to send the tx.
    */
    function orderBroker(bytes32 _orderId) public view returns (address){
        return orders[_orderId].broker;
    }

    /**
    * orderConfirmer will return the darknode address which confirms the given orderID.
    */
    function orderConfirmer(bytes32 _orderId) public view returns (address){
        return orders[_orderId].confirmer;
    }

    /**
    * orderDepth will return the block depth of the orderId
    */
    function orderDepth(bytes32 _orderId) public view returns (uint256) {
        if (orders[_orderId].blockNumber == 0) {
            return 0;
        }
        return (block.number - orders[_orderId].blockNumber);
    }

    /**
    * getOrdersCount will return the number of orders in the orderbook
    */
    function getOrdersCount() public view returns (uint256){
        return buyOrders.length + sellOrders.length;
    }

    /**
    * getOrder will return orderId of the given index in the orderbook list and true if exists.
    * Otherwise it will return empty bytes and false.
    */
    function getOrder(uint256 index) public view returns (bytes32, bool){
        if (index >= orderbook.length) {
            return ("", false);
        }

        return (orderbook[index], true);
    }

    /**
    * getOrder will return order details of the orders starting from the offset.
    */
    function getOrders(uint256 offset, uint256 limit) public view returns (bytes32[], address[], uint8[]){
        if (offset >= orderbook.length) {
            return;
        }

        bytes32[] orderIDs;
        address[] traderAddresses;
        uint8[] states;

        for (uint256 i = offset; i < offset + limit; i++) {
            if (i == orderbook.length) {
                return (orderIDs, traderAddresses, states);
            }

            orderIDs.push(orderbook[i]);
            traderAddresses.push(orders[orderbook[i]].trader);
            states.push(uint8(orders[orderbook[i]].state));
        }

        return (orderIDs, traderAddresses, states);
    }
}

