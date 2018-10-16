pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Claimable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./DarknodeRegistry.sol";
import "./SettlementRegistry.sol";
import "./BrokerVerifier.sol";
import "./libraries/Utils.sol";

/// @notice The Orderbook contract stores the state and priority of orders and
/// allows the Darknodes to easily reach consensus. Eventually, this contract
/// will only store a subset of order states, such as cancellation, to improve
/// the throughput of orders.
contract Orderbook is Claimable {
    using SafeMath for uint256;

    /// @notice OrderState enumerates the possible states of an order. All
    /// orders default to the Undefined state.
    enum OrderState {Undefined, Open, Confirmed, Canceled}

    string public VERSION; // Passed in as a constructor parameter.

    DarknodeRegistry public darknodeRegistry;
    SettlementRegistry public settlementRegistry;

    /// @notice Order stores a subset of the public data associated with an order.
    struct Order {
        OrderState state;     // State of the order
        uint32  OrderType;    // Type of the order
        uint64  settlementID; // The settlement that signed the order opening
        address trader;       // Trader that owns the order
        address confirmer;    // Darknode that confirmed the order in a match
        bytes32 matchedOrder; // Order confirmed in a match with this order
    }

    bytes32[] private orderbook;

    // Order details are exposed through directly accessing this mapping, or
    // through the getter functions below for each of the order's fields.
    mapping(bytes32 => Order) public orders;

    event LogDarknodeRegistryUpdated(DarknodeRegistry previousDarknodeRegistry, DarknodeRegistry nextDarknodeRegistry);
    event LogSettlementRegistryUpdated(SettlementRegistry previousSettlementRegistry, SettlementRegistry nextSettlementRegistry);

    event LogOrderOpen(bytes32 indexed orderID, uint256 blockNumber);
    event LogOrderConfirmed(bytes32 indexed orderID, uint256 blockNumber);
    event LogOrderCanceled(bytes32 indexed orderID);

    /// @notice Only allow registered dark nodes.
    modifier onlyDarknode(address _sender) {
        require(darknodeRegistry.isRegistered(_sender), "must be registered darknode");
        _;
    }

    /// @notice The contract constructor.
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _darknodeRegistry The address of the DarknodeRegistry contract.
    /// @param _settlementRegistry The address of the SettlementRegistry
    ///        contract.
    constructor(
        string _VERSION,
        DarknodeRegistry _darknodeRegistry,
        SettlementRegistry _settlementRegistry
    ) public {
        VERSION = _VERSION;
        darknodeRegistry = _darknodeRegistry;
        settlementRegistry = _settlementRegistry;
    }

    /// @notice Allows the owner to update the address of the DarknodeRegistry
    /// contract.
    function updateDarknodeRegistry(DarknodeRegistry _newDarknodeRegistry) external onlyOwner {
        // Basic validation knowing that DarknodeRegistry exposes VERSION
        require(bytes(_newDarknodeRegistry.VERSION()).length > 0, "invalid darknode registry contract");

        emit LogDarknodeRegistryUpdated(darknodeRegistry, _newDarknodeRegistry);
        darknodeRegistry = _newDarknodeRegistry;
    }

    /// @notice Allows the owner to update the address of the SettlementRegistry
    /// contract.
    function updateSettlementRegistry(SettlementRegistry _newSettlementRegistry) external onlyOwner {
        // Basic validation knowing that SettlementRegistry exposes VERSION
        require(bytes(_newSettlementRegistry.VERSION()).length > 0, "invalid settlement registry contract");

        emit LogSettlementRegistryUpdated(settlementRegistry, _newSettlementRegistry);
        settlementRegistry = _newSettlementRegistry;
    }

    /// @notice Open an order in the orderbook. The order must be in the
    /// Undefined state.
    ///
    /// @param _signature Signature of the message that defines the trader. The
    ///        message is "Republic Protocol: open: {orderId}".
    /// @param _orderID The hash of the order.
    function openOrder(uint64 _settlementID, bytes _signature, bytes32 _orderID) external {
        require(orders[_orderID].state == OrderState.Undefined, "invalid order status");

        address trader = msg.sender;

        // Verify the order signature
        require(settlementRegistry.settlementRegistration(_settlementID), "settlement not registered");
        BrokerVerifier brokerVerifier = settlementRegistry.brokerVerifierContract(_settlementID);
        require(brokerVerifier.verifyOpenSignature(trader, _signature, _orderID), "invalid broker signature");

        orders[_orderID] = Order({
            state: OrderState.Open,
            trader: trader,
            confirmer: 0x0,
            settlementID: _settlementID,
            blockNumber: block.number,
            matchedOrder: 0x0
        });
        LogOrderOpen(_orderID, block.number);
        LogOrderPriority(_orderID, orderbook.length + 1);

        orderbook.push(_orderID);
    }

    /// @notice Confirm an order match between orders. The confirmer must be a
    /// registered Darknode and the orders must be in the Open state. A
    /// malicious confirmation by a Darknode will result in a bond slash of the
    /// Darknode.
    ///
    /// @param _orderID The hash of the order.
    /// @param _matchedOrderID The hashes of the matching order.
    function confirmOrder(bytes32 _orderID, bytes32 _matchedOrderID) external onlyDarknode(msg.sender) {
        require(orders[_orderID].state == OrderState.Open, "invalid order status");
        require(orders[_matchedOrderID].state == OrderState.Open, "invalid order status");

        orders[_orderID].state = OrderState.Confirmed;
        orders[_orderID].confirmer = msg.sender;
        orders[_orderID].matchedOrder = _matchedOrderID;

        orders[_matchedOrderID].state = OrderState.Confirmed;
        orders[_matchedOrderID].confirmer = msg.sender;
        orders[_matchedOrderID].matchedOrder = _orderID;

        LogOrderConfirmed(_orderID, block.number);
        LogOrderOpen(_matchedOrderID, block.number);
    }

    /// @notice Cancel an open order in the orderbook. An order can be cancelled
    /// by the trader who opened the order, or by the broker verifier contract.
    /// This allows the settlement layer to implement their own logic for
    /// cancelling orders without trader interaction (e.g. to ban a trader from
    /// a specific darkpool, or to use multiple order-matching platforms)
    ///
    /// @param _orderID The hash of the order.
    function cancelOrder(bytes32 _orderID) external {
        require(orders[_orderID].state == OrderState.Open, "invalid order state");

        // Require the msg.sender to be the trader or the broker verifier :
        if (msg.sender != orders[_orderID].trader){
            address brokerVerifier = settlementRegistry.brokerVerifierContract(orders[_orderID].settlementID);
            require(msg.sender == brokerVerifier, "not authorized");
        }

        orders[_orderID].state = OrderState.Canceled;
        LogOrderCanceled(_orderID);
    }

    /// @notice returns status of the given orderID.
    function orderState(bytes32 _orderID) external view returns (OrderState) {
        return orders[_orderID].state;
    }

    /// @notice returns a list of matched orders to the given orderID.
    function orderMatch(bytes32 _orderID) external view returns (bytes32) {
        return orders[_orderID].matchedOrder;
    }

    /// @notice returns the trader of the given orderID.
    /// Trader is the one who signs the message and does the actual trading.
    function orderTrader(bytes32 _orderID) external view returns (address) {
        return orders[_orderID].trader;
    }

    /// @notice returns the darknode address which confirms the given orderID.
    function orderConfirmer(bytes32 _orderID) external view returns (address) {
        return orders[_orderID].confirmer;
    }

    /// @notice returns the total number of orders in the orderbook, including
    /// orders that are no longer open
    function ordersCount() external view returns (uint256) {
        return orderbook.length;
    }

    /// @notice returns order details of the orders starting from the offset.
    function getOrders(uint256 _offset, uint256 _limit) external view returns (bytes32[], address[], uint8[]) {
        if (_offset >= orderbook.length) {
            return;
        }

        // If the provided limit is more than the number of orders after the offset,
        // decrease the limit
        uint256 limit = _limit;
        if (_offset.add(limit) > orderbook.length) {
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
}

