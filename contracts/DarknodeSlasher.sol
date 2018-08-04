pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./DarknodeRegistry.sol";
import "./Orderbook.sol";
import "./SettlementUtils.sol";

/// @notice Allows order confirmations to be challenged, penalizing darknodes
/// who have confirmed two mismatched orders.
/// @author Republic Protocol
contract DarknodeSlasher is Ownable {

    DarknodeRegistry public trustedDarknodeRegistry;
    Orderbook public trustedOrderbook;

    mapping(bytes32 => bool) public orderDetailsSubmitted;
    mapping(bytes32 => mapping(bytes32 => bool)) public challengeSubmitted;
    mapping(bytes32 => SettlementUtils.OrderDetails) public orderDetails;
    mapping(bytes32 => address) public challengers;

    /// @notice Restricts calling a function to registered or deregistered darknodes
    modifier onlyDarknode() {
        require(
            trustedDarknodeRegistry.isRegistered(msg.sender) || 
            trustedDarknodeRegistry.isDeregistered(msg.sender),
            "must be darknode");
        _;
    }

    /// @param _darknodeRegistry The address of the DarknodeRegistry contract
    /// @param _orderbook The address of the Orderbook contract
    constructor(DarknodeRegistry _darknodeRegistry, Orderbook _orderbook) public {
        trustedDarknodeRegistry = _darknodeRegistry;
        trustedOrderbook = _orderbook;
    }

    /// @notice Submits the details for one of the two orders of a challenge.
    /// The details are required to verify that the orders shout not have been
    /// matched together.
    function submitChallengeOrder(
        bytes details,
        uint64 settlementID,
        uint64 tokens,
        uint256 price,
        uint256 volume,
        uint256 minimumVolume
    ) external onlyDarknode {
        SettlementUtils.OrderDetails memory order = SettlementUtils.OrderDetails({
            details: details,
            settlementID: settlementID,
            tokens: tokens,
            price: price,
            volume: volume,
            minimumVolume: minimumVolume
        });

        // Hash the order
        bytes32 orderID = SettlementUtils.hashOrder(order);

        // Check the order details haven't already been submitted
        require(!orderDetailsSubmitted[orderID], "already submitted");

        // Store the order details and the challenger
        orderDetails[orderID] = order;
        challengers[orderID] = msg.sender;
        orderDetailsSubmitted[orderID] = true;
    }

    /// @notice Submits 
    function submitChallenge(bytes32 _buyID, bytes32 _sellID) external {
        // Check that the match hasn't been submitted previously
        require(!challengeSubmitted[_buyID][_sellID], "already challenged");

        // Check that the orders were submitted to one another
        require(SettlementUtils.verifyOrderPair(trustedOrderbook, _buyID, _sellID), "invalid challenge");

        // The challenge is valid if 1) the order details (prices, volumes,
        // settlement IDs or tokens) are not compatible, or if 2) the orders
        // where submitted by the same trader.
        bool mismatchedDetails = !SettlementUtils.verifyMatchDetails(orderDetails[_buyID], orderDetails[_sellID]);
        bool nondistinctTrader = trustedOrderbook.orderTrader(_buyID) == trustedOrderbook.orderTrader(_sellID);
        require(mismatchedDetails || nondistinctTrader, "invalid challenge");

        // Retrieve the guilty confirmer
        address confirmer = trustedOrderbook.orderConfirmer(_buyID);

        // Store that challenge has been submitted
        challengeSubmitted[_buyID][_sellID] = true;
        challengeSubmitted[_sellID][_buyID] = true;

        // Slash the bond of the confirmer
        trustedDarknodeRegistry.slash(confirmer, challengers[_buyID], challengers[_sellID]);
    }
}