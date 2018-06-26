pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./DarknodeRegistry.sol";
import "./libraries/ECDSA.sol";

/**
  * @notice The Orderbook contract stores the state and priority of orders and
  * allows the Darknodes to easily reach consensus. Eventually, this contract
  * will only store a subset of order states, such as cancelation, to improve
  * the throughput of orders.
  */
contract Orderbook is Ownable {

    /**
      * @notice OrderState enumerates the possible states of an order. All
      * orders default to the Undefined state.
      */
    enum OrderState {Undefined, Open, Confirmed, Canceled}

    /**
      * @notice Order stores a subset of the public data associated with an
      * order.
      */
    struct Order {
        OrderState state;    // State of the order
        address trader;      // Trader that owns the order
        address broker;      // Broker that approved this order
        address confirmer;   // Darknode that confirmed the order in a match
        uint256 priority;    // Logical time priority of this order
        uint256 blockNumber; // Block number of the most recent state change
        bytes32[] matches;   // Orders confirmed in a match with this order
    }

    bytes32[] public buyOrders;
    bytes32[] public sellOrders;
    bytes32[] orderbook;

    mapping(bytes32 => Order) private orders;

    uint256 public fee;
    RepublicToken public ren;
    DarknodeRegistry public darknodeRegistry;

    event FeeUpdated(uint256 previousFee, uint256 nextFee);
    event DarknodeRegistryUpdated(DarknodeRegistry previousDarknodeRegistry, DarknodeRegistry nextDarknodeRegistry);

    /**
      * @notice Only allow registered dark nodes.
      */
    modifier onlyDarknode(address _sender) {
        require(darknodeRegistry.isRegistered(bytes20(_sender)));
        _;
    }

    /**
      * @notice The Orderbook constructor.
      *
      * @param _fee The fee in REN for opening an order. This is given in AI,
      *             the smallest denomination of REN.
      * @param _renAddress The address of the RepublicToken contract.
      * @param _darknodeRegistry The address of the DarknodeRegistry contract.
     */
    constructor(uint256 _fee, RepublicToken _renAddress, DarknodeRegistry _darknodeRegistry) public {
        fee = _fee;
        ren = _renAddress;
        darknodeRegistry = _darknodeRegistry;
    }

    function updateFee(uint256 _newFee) public onlyOwner {
        emit FeeUpdated(fee, _newFee);
        fee = _newFee;
    }

    function updateDarknodeRegistry(DarknodeRegistry _newDarknodeRegistry) public onlyOwner {
        emit DarknodeRegistryUpdated(darknodeRegistry, _newDarknodeRegistry);
        darknodeRegistry = _newDarknodeRegistry;
    }

    /**
      * @notice Open a buy order in the orderbook. The order must be in the
      * Undefined state and an allowance of REN is required to pay the opening
      * fee.
      *
      * @param _signature Signature of the message that defines the trader. The
      *                   message is "Republic Protocol: open: {orderId}".
      * @param _orderId The hash of the order.
      */
    function openBuyOrder(bytes _signature, bytes32 _orderId) public {
        openOrder(_signature, _orderId);
        buyOrders.push(_orderId);
        orders[_orderId].priority = buyOrders.length;
    }

    /**
      * @notice Open a sell order in the orderbook. The order must be in the
      * Undefined state and an allowance of REN is required to pay the opening
      * fee.
      *
      * @param _signature Signature of a message that defines the trader. The
      *                   message is "Republic Protocol: open: {orderId}".
      * @param _orderId The hash of the order.
      */
    function openSellOrder(bytes _signature, bytes32 _orderId) public {
        openOrder(_signature, _orderId);
        sellOrders.push(_orderId);
        orders[_orderId].priority = sellOrders.length;
    }

    /**
      * @notice Confirm an order match between orders. The confirmer must be a
      * registered Darknode and the orders must be in the Open state. A
      * malicious confirmation by a Darknode will result in a bond slash of the
      * Darknode.
      *
      * @param _orderId The hash of the order.
      * @param _orderMatches The hashes of the matching order.
      */
    function confirmOrder(bytes32 _orderId, bytes32[] _orderMatches) public onlyDarknode(msg.sender) {
        require(orders[_orderId].state == OrderState.Open);
        for (uint256 i = 0; i < _orderMatches.length; i++) {
            require(orders[_orderMatches[i]].state == OrderState.Open);
        }

        for (i = 0; i < _orderMatches.length; i++) {
            // TODO: Require that the order type is the opposite to _orderId's
            orders[_orderMatches[i]].state = OrderState.Confirmed;
            orders[_orderMatches[i]].matches = [_orderId];
            orders[_orderMatches[i]].blockNumber = block.number;
        }
        orders[_orderId].state = OrderState.Confirmed;
        orders[_orderId].confirmer = msg.sender;
        orders[_orderId].matches = _orderMatches;
        orders[_orderId].blockNumber = block.number;
    }

    /**
      * @notice Cancel an order in the orderbook. The order must be in the
      * Undefined or Open state.
      *
      * @param _signature Signature of a message from the trader. The message
      *                   is "Republic Protocol: cancel: {orderId}".
      * @param _orderId The hash of the order.
      */
    function cancelOrder(bytes _signature, bytes32 _orderId) public {
        if (orders[_orderId].state == OrderState.Open) {
            // Recover trader address from the signature
            bytes32 data = keccak256(abi.encodePacked("Republic Protocol: cancel: ", _orderId));
            address trader = ECDSA.addr(data, _signature);
            require(orders[_orderId].trader == trader);
        } else {
            // An unopened order can be canceled to ensure that it cannot be
            // opened in the future.
            // FIXME: This create the possibility of a DoS attack where a node
            // or miner submits a cancelOrder with a higher fee everytime they
            // see an openOrder from a particular trader. To solve this, order
            // cancelations should be stored against a specific trader.
            require(orders[_orderId].state == OrderState.Undefined);
        }

        orders[_orderId].state = OrderState.Canceled;
        orders[_orderId].blockNumber = block.number;
    }

    /**
     * @return The order hash at the given index in buy order list and a bool
     * flag defining whether or not an order actually exists at that index.
     */
    function buyOrder(uint256 _index) public view returns (bytes32, bool){
        if (_index >= buyOrders.length) {
            return ("", false);
        }

        return (buyOrders[_index], true);
    }

    /**
    * sellOrder will return orderId of the given index in sell order list and true if exists.
    * Otherwise it will return empty bytes and false.
    */
    function sellOrder(uint256 _index) public view returns (bytes32, bool){
        if (_index >= sellOrders.length) {
            return ("", false);
        }

        return (sellOrders[_index], true);
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
    * orderBlockNumber will return the block number when the order being last modified.
    */
    function orderBlockNumber(bytes32 _orderId) public view returns (uint256) {
        return orders[_orderId].blockNumber;
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
    function getOrder(uint256 _index) public view returns (bytes32, bool){
        if (_index >= orderbook.length) {
            return ("", false);
        }

        return (orderbook[_index], true);
    }

    /**
    * getOrder will return order details of the orders starting from the offset.
    */
    function getOrders(uint256 _offset, uint256 _limit) public view returns (bytes32[], address[], uint8[]){
        if (_offset >= orderbook.length) {
            return;
        }

        // If the provided limit is more than the number of orders after the offset,
        // decrease the limit
        uint256 limit = _limit;
        if (_offset + limit > orderbook.length) {
            limit = orderbook.length - _offset;
        }

        bytes32[] memory orderIDs = new bytes32[](limit);
        address[] memory traderAddresses = new address[](limit);
        uint8[] memory states = new uint8[](limit);

        for (uint256 i = 0; i < limit; i++) {
            bytes32 order = orderbook[i + _offset];
            orderIDs[i] = order;
            traderAddresses[i] = orders[order].trader;
            states[i] = uint8(orders[order].state);
        }

        return (orderIDs, traderAddresses, states);
    }

    function openOrder(bytes _signature, bytes32 _orderId) private {
        // require(ren.allowance(msg.sender, this) >= fee);
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
}

