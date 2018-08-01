pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
@title A library for calculating and verify order match details
@author Republic Protocol
*/
library SettlementUtils {
    using SafeMath for uint256;

    enum OrderType {Midpoint, Limit}
    enum OrderParity {Buy, Sell}

    struct OrderDetails {
        uint32 settlementID;
        uint8 parity;
        uint8 orderType;
        uint64 expiry;
        uint64 tokens;
        uint256 price;
        uint256 volume;
        uint256 minimumVolume;
        uint256 nonceHash;
    }

    /********** SETTLEMENT FUNCTIONS ******************************************/
    /**
     * @notice Calculates the ID of the order
     * @param order the order to hash
     */
    function hashOrder(OrderDetails order) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            order.orderType,
            order.parity,
            order.settlementID,
            order.expiry,
            order.tokens,
            order.price,
            order.volume,
            order.minimumVolume,
            order.nonceHash
        ));
    }

    /**
     * @notice Verifies details about an match

     * @param _buy the buy order details
     * @param _sell the sell order details
     */
    function verifyMatch(OrderDetails _buy, OrderDetails _sell) internal pure returns (bool) {
        return (_buy.parity == uint8(OrderParity.Buy) &&  // Require that the orders are confirmed to one another
                _sell.parity == uint8(OrderParity.Sell) &&
                _buy.price >= _sell.price && // Buy price should be greater than sell price
                _buy.volume >= _sell.minimumVolume &&  // Buy volume should be greater than sell minimum volume
                _sell.volume >= _buy.minimumVolume &&  // Sell volume should be greater than buy minimum volume
                _buy.settlementID == _sell.settlementID  // Require that the orders were submitted to the same settlement layer
            );
    }
}