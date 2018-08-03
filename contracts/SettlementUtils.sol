pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/// @title A library for calculating and verify order match details
/// @author Republic Protocol
library SettlementUtils {
    using SafeMath for uint256;
    
    struct OrderDetails {
        bytes details;
        uint64 settlementID;
        uint64 tokens;
        uint256 price;
        uint256 volume;
        uint256 minimumVolume;
    }

    /********** SETTLEMENT FUNCTIONS ******************************************/
    /// @notice Calculates the ID of the order
    /// @param order the order to hash
    function hashOrder(OrderDetails order) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                order.details,
                order.settlementID,
                order.tokens,
                order.price,
                order.volume,
                order.minimumVolume
            )
        );
    }

    /// @notice Verifies details about a match
    /// @param _buy the buy order details
    /// @param _sell the sell order details
    function verifyMatch(OrderDetails _buy, OrderDetails _sell) internal pure returns (bool) {
        return (verifyTokens(_buy.tokens, _sell.tokens) && // Buy and sell tokens should match.
                _buy.price >= _sell.price && // Buy price should be greater than sell price
                _buy.volume >= _sell.minimumVolume &&  // Buy volume should be greater than sell minimum volume
                _sell.volume >= _buy.minimumVolume &&  // Sell volume should be greater than buy minimum volume
                _buy.settlementID == _sell.settlementID  // Require that the orders were submitted to the same settlement layer
            );
    }

    /// @notice Verifies tokens about a match
    /// @param _buy the buy token details
    /// @param _sell the sell token details
    function verifyTokens(uint64 _buy, uint64 _sell) internal pure returns (bool) {
        return (uint32(_buy) == uint32(_sell >> 32) &&
                uint32(_sell) == uint32(_buy >> 32)
        );
    }
}