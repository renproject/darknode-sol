pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./DarknodeRegistry.sol";
import "./Orderbook.sol";
import "./SettlementUtils.sol";

contract DarknodeSlasher is Ownable {

    DarknodeRegistry public trustedDarknodeRegistry;
    Orderbook public trustedOrderbook;

    mapping(bytes32 => SettlementUtils.OrderDetails) public orderDetails;
    mapping(bytes32 => address) public challengers;

    modifier onlyDarknode() {
        require(trustedDarknodeRegistry.isRegistered(msg.sender) || trustedDarknodeRegistry.isDeregistered(msg.sender), "must be darknode");
        _;
    }

    constructor(DarknodeRegistry darknodeRegistry, Orderbook orderbook) public {
        trustedDarknodeRegistry = darknodeRegistry;
        trustedOrderbook = orderbook;
    }

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
        bytes32 orderID = SettlementUtils.hashOrder(order);
        require(challengers[orderID] == address(0x0), "already challenged");
        orderDetails[orderID] = order;
        challengers[orderID] = msg.sender;
    }

    function submitChallenge(bytes32 _buyOrder, bytes32 _sellOrder) external {
        require(!SettlementUtils.verifyMatch(orderDetails[_buyOrder], orderDetails[_sellOrder]), "invalid challenge");
        address confirmer = trustedOrderbook.orderConfirmer(_buyOrder);
        slash(confirmer, challengers[_buyOrder], challengers[_sellOrder]);
    }
    
    function slash(address _prover, address _challenger1, address _challenger2) internal {
        trustedDarknodeRegistry.slash(_prover, _challenger1, _challenger2);
    }
}