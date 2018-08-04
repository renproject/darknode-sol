pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./Orderbook.sol";

/// @title A library for calculating and verifying order match details
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

    /// @notice Verifies that two orders match when considering the tokens,
    /// price, volumes / minimum volumes and settlement IDs. verifyMatch is used
    /// my the DarknodeSlasher to verify challenges. Settlement layers may also
    /// use this function.
    /// @param _buy The buy order details.
    /// @param _sell The sell order details.
    function verifyMatch(Orderbook _orderbookContract, OrderDetails _buy, OrderDetails _sell) internal view returns (bool) {

        // Buy and sell tokens should match
        if (!verifyTokens(_buy.tokens, _sell.tokens)) {
            return false;
        }

        // Buy price should be greater than sell price
        if (_buy.price < _sell.price) {
            return false;
        }

        // // Buy volume should be greater than sell minimum volume
        if (_buy.volume < _sell.minimumVolume) {
            return false;
        }

        // Sell volume should be greater than buy minimum volume
        if (_sell.volume < _buy.minimumVolume) {
            return false;
        }
        
        // Require that the orders were submitted to the same settlement layer
        if (_buy.settlementID != _sell.settlementID) {
            return false;
        }

        // Check that the two trades where matched to one another
        bytes32 buyID = hashOrder(_buy);
        bytes32 sellID = hashOrder(_sell);
        bytes32[] memory buyMatches = _orderbookContract.orderMatches(buyID);
        bool inMatchList = false;
        for (uint256 i = 0; i < buyMatches.length; i++) {
            if (buyMatches[i] == sellID) {
                inMatchList = true;
                break;
            }
        }
        if (!inMatchList) {
            return false;
        }

        // Check that the orders are from distinct traders
        if (_orderbookContract.orderTrader(buyID) == _orderbookContract.orderTrader(sellID)) {
            return false;
        }
        
        return true;
    }

    /// @notice Verifies that two token requirements can be matched.
    /// @param _buyTokens The buy token details.
    /// @param _sellToken The sell token details.
    function verifyTokens(uint64 _buyTokens, uint64 _sellToken) internal pure returns (bool) {
        return (uint32(_buyTokens) == uint32(_sellToken >> 32) &&
                uint32(_sellToken) == uint32(_buyTokens >> 32)
        );
    }
}