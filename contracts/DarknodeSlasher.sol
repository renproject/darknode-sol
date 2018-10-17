pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./DarknodeRegistry.sol";
import "./Orderbook.sol";
import "./SettlementUtils.sol";

/// @notice Allows order confirmations to be challenged, penalizing darknodes
/// who have confirmed two mismatched orders.
contract DarknodeSlasher is Ownable {
    string public VERSION; // Passed in as a constructor parameter.

    DarknodeRegistry public trustedDarknodeRegistry;
    Orderbook public trustedOrderbook;

    mapping(bytes32 => bool) public orderSubmitted;
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

    /// @notice The contract constructor.
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _darknodeRegistry The address of the DarknodeRegistry contract
    /// @param _orderbook The address of the Orderbook contract
    constructor(string _VERSION, DarknodeRegistry _darknodeRegistry, Orderbook _orderbook) public {
        VERSION = _VERSION;
        trustedDarknodeRegistry = _darknodeRegistry;
        trustedOrderbook = _orderbook;
    }

    /// @notice Submits the details for one of the two orders of a challenge.
    /// The details are required to verify that the orders should not have been
    /// matched together. The parameters are the same as `submitOrder` in the
    /// Settlement interface.
    function submitChallengeOrder(
        bytes details,
        uint64 settlementID,
        uint64 tokens,
        uint256 price,
        uint256 volume,
        uint256 minimumVolume
    ) external onlyDarknode {
        SettlementUtils.OrderDetails memory order = SettlementUtils.OrderDetails({
            settlementID: settlementID,
            tokens: tokens,
            price: price,
            volume: volume,
            minimumVolume: minimumVolume
        });

        // Hash the order
        bytes32 orderID = SettlementUtils.hashOrder(details, order);

        // Check the order details haven't already been submitted
        require(!orderSubmitted[orderID], "already submitted");

        // Store the order details and the challenger
        orderDetails[orderID] = order;
        challengers[orderID] = msg.sender;
        orderSubmitted[orderID] = true;
    }

    /// @notice Submits a challenge for two orders. This challenge is a claim
    /// that two orders were confirmed that should not have been confirmed.
    /// Before calling this method, `submitOrder` must be called for both the
    /// `_buyID` and `_sellID` orders.
    ///
    /// @param _buyID The order ID of a buy order that was maliciously
    ///        confirmed with the `_sellID`.
    /// @param _sellID The order ID of a sell order that was maliciously
    ///        confirmed with the `_buyID`.
    function submitChallenge(bytes32 _buyID, bytes32 _sellID) external {
        // Check that the match hasn't been submitted previously
        require(!challengeSubmitted[_buyID][_sellID], "already challenged");

        // Check that the order details have been submitted
        require(orderSubmitted[_buyID], "details unavailable");
        require(orderSubmitted[_sellID], "details unavailable");

        // Check that the orders were submitted to one another
        require(trustedOrderbook.orderMatch(_buyID) == _sellID, "unconfirmed orders");

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