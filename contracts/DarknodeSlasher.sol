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

    enum OrderStatus {None, Submitted}
    enum ChallengeStatus {None, Slashed}

    mapping(bytes32 => OrderStatus) public orderStatus;
    mapping(bytes32 => ChallengeStatus) public challengeStatus;
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
        require(orderStatus[orderID] == OrderStatus.None, "already submitted");

        // Store the order details and the challenger
        orderDetails[orderID] = order;
        challengers[orderID] = msg.sender;
        orderStatus[orderID] = OrderStatus.Submitted;
    }

    /// @notice Submits 
    function submitChallenge(bytes32 _buyOrder, bytes32 _sellOrder) external {
        // Check that the match hasn't been submitted previously
        bytes32 matchID = keccak256(abi.encodePacked(_buyOrder, _sellOrder));
        require(challengeStatus[matchID] == ChallengeStatus.None, "already submitted");

        // Check that verifyMatch returns FALSE
        require(!SettlementUtils.verifyMatch(trustedOrderbook, orderDetails[_buyOrder], orderDetails[_sellOrder]), "invalid challenge");

        // Retrieve the guilty confirmer
        address confirmer = trustedOrderbook.orderConfirmer(_buyOrder);
        require(confirmer != 0x0, "unconfirmed order");

        // Store that challenge has been submitted
        challengeStatus[matchID] == ChallengeStatus.Slashed;

        // Slash the bond of the confirmer
        trustedDarknodeRegistry.slash(confirmer, challengers[_buyOrder], challengers[_sellOrder]);
    }
}