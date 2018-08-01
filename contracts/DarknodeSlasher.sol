pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./DarknodeRegistry.sol";
import "./OrderBook.sol";
import "./SettlementUtils.sol";

contract DarknodeSlasher is Ownable {

    DarknodeRegistry public trustedDarknodeRegistry;
    Orderbook public trustedOrderbook;

    mapping(bytes32 => SettlementUtils.OrderDetails) public orderDetails;
    mapping(bytes32 => address) public challengers;

    modifier onlyDarknode() {
        require(trustedDarknodeRegistry.isRegistered(msg.sender) || trustedDarknodeRegistry.isDeregistered(msg.sender));
        _;
    }

    constructor(DarknodeRegistry darknodeRegistry, Orderbook orderbook) public {
        trustedDarknodeRegistry = darknodeRegistry;
        trustedOrderbook = orderbook;
    }

    function submitChallengeOrder(
        uint32 settlementID,
        uint8 parity,
        uint8 orderType,
        uint64 expiry,
        uint64 tokens,
        uint256 price,
        uint256 volume,
        uint256 minimumVolume,
        uint256 nonceHash
    ) external onlyDarknode {
        SettlementUtils.OrderDetails memory order = SettlementUtils.OrderDetails({
            orderType: orderType,
            parity: parity,
            settlementID: settlementID,
            expiry: expiry,
            tokens: tokens,
            price: price,
            volume: volume,
            minimumVolume: minimumVolume,
            nonceHash: nonceHash
        });
        bytes32 orderID = SettlementUtils.hashOrder(order);
        require(challengers[orderID] == address(0x0));
        orderDetails[orderID] = order;
        challengers[orderID] = msg.sender;
    }

    function submitChallenge(bytes32 _buyOrder, bytes32 _sellOrder) external onlyDarknode {
        address buyConfirmer = trustedOrderbook.orderConfirmer(_buyOrder);
        address sellConfirmer = trustedOrderbook.orderConfirmer(_sellOrder);
        assert(buyConfirmer == sellConfirmer);
        require(!SettlementUtils.verifyMatch(orderDetails[_buyOrder], orderDetails[_sellOrder]));
        slash(buyConfirmer, buyConfirmer, sellConfirmer);
    }
    
    function slash(address _prover, address _challenger1, address _challenger2) internal {
        trustedDarknodeRegistry.slash(_prover, _challenger1, _challenger2);
    }

}