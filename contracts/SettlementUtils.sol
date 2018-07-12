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
        uint64 priceC; uint64 priceQ;
        uint64 volumeC; uint64 volumeQ;
        uint64 minimumVolumeC; uint64 minimumVolumeQ;
        uint256 nonceHash;
    }

    /********** SETTLEMENT FUNCTIONS ******************************************/

    // Price/volume calculation functions

    /**
     * @notice Returns true if the left tuple represents a larger number than
     * the right tuple
     */
    function tupleGTE(uint64 leftC, uint64 leftQ, uint64 rightC, uint64 rightQ) internal pure returns (bool) {
        if (leftQ < rightQ) {
            return false;
        }

        uint256 norm = leftC * 10 ** uint256(leftQ - rightQ);

        return norm >= rightC;
    }

    /**
     * @notice Returns the midpoint between the buy and sell prices as a tuple
     */
    function priceMidPoint(OrderDetails buy, OrderDetails sell) internal pure returns (uint256, int256) {
        // Normalize to same exponent before finding mid-point (mean)
        uint256 norm = uint256(buy.priceC) * 10 ** uint256(buy.priceQ - sell.priceQ);
        int256 q = int256(sell.priceQ);
        uint256 sum = (sell.priceC + norm);
        if (sum % 2 == 0) {
            return (sum / 2, q);
        } else {
            // To not lose the .5 for odd numbers, multiply by 5 and subtract from q
            return (sum * (10 / 2), q - 1);
        }
    }

    /**
     * @notice Returns the smaller volume in the high token
     */
    function minimumVolume(OrderDetails buy, OrderDetails sell, uint256 priceC, int256 priceQ)
    internal pure returns (uint256, int256, uint256) {
        uint256 buyV = tupleToVolume(buy.volumeC, int256(buy.volumeQ), 1, 12);
        uint256 sellV = tupleToScaledVolume(sell.volumeC, int256(sell.volumeQ), priceC, priceQ, 1, 12);

        if (buyV < sellV) {
            // Instead of dividing the constant by priceC, we delay the division
            // until the recombining c and q, to ensure that minimal precision
            // is lost
            return (buy.volumeC * 200, int256(buy.volumeQ + 26 + 12) - priceQ, priceC);
        } else {
            return (sell.volumeC, int256(sell.volumeQ), 1);
        }
    }

    /**
     * @notice Converts a tuple to a volume after multiplying by the price
     */
    function tupleToScaledVolume(uint256 volC, int256 volQ, uint256 priceC, int256 priceQ, uint256 divideC, uint256 decimals)
    internal pure returns (uint256) {
        // 0.2 turns into 2 * 10**-1 (-1 moved to exponent)
        // 0.005 turns into 5 * 10**-3 (-3 moved to exponent)
        uint256 c = volC * 5 * priceC * 2;

        int256 e = int256(decimals) + volQ + priceQ - (26 + 12 + 3 + 12 + 1);

        // If (ep-en) is negative, divide instead of multiplying
        uint256 value;
        if (e >= 0) {
            value = c * 10 ** uint256(e);
        } else {
            value = c / 10 ** uint256(-e);
        }

        value = value / divideC;

        return value;
    }

    /**
     * @notice Converts a tuple to a price
     */
    function tupleToPrice(uint256 priceC, int256 priceQ, uint256 decimals)
    internal pure returns (uint256) {
        // 0.2 turns into 2 * 10**-1 (-1 moved to exponent)
        // 0.005 turns into 5 * 10**-3 (-3 moved to exponent)
        uint256 c = priceC * 5;

        int256 e = int256(decimals) + priceQ - (26 + 12 + 3);

        // If (ep-en) is negative, divide instead of multiplying
        uint256 value;
        if (e >= 0) {
            value = c * 10 ** uint256(e);
        } else {
            value = c / 10 ** uint256(-e);
        }

        return value;
    }

    /**
     * @notice Converts a tuple to a volume
     */
    function tupleToVolume(uint256 volC, int256 volQ, uint256 divideC, uint256 decimals) internal pure returns (uint256) {
        // 0.2 turns into 2 * 10**-1 (-1 moved to exponent)
        uint256 c = 2 * volC;

        // Positive and negative components of exponent
        uint256 ep = decimals;
        uint256 en = 12 + 1;
        // Add volQ to positive or negative component based on its sign
        if (volQ < 0) {
            en += uint256(-volQ);
        } else {
            ep += uint256(volQ);
        }

        // If (ep-en) is negative, divide instead of multiplying
        uint256 value;
        if (ep >= en) {
            value = c * 10 ** (ep - en);
        } else {
            value = c / 10 ** (en - ep);
        }

        value = value / divideC;

        return value;
    }



    /**
     * @notice Calculates the ID of the order
     * @param order the order to hash
     */
    function hashOrder(OrderDetails order) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                order.orderType,
                order.parity,
                order.settlementID,
                order.expiry,
                order.tokens,
                order.priceC, order.priceQ,
                order.volumeC, order.volumeQ,
                order.minimumVolumeC, order.minimumVolumeQ,
                order.nonceHash
            )
        );
    }


    /**
     * @notice Verifies details about an order

     * @param _order the order details to be verified
     */
    function verifyOrder(OrderDetails _order) internal pure {
        // Verify price ranges
        require(_order.priceC <= 1999);
        require(_order.priceQ <= 52);

        // Verify volume ranges
        require(_order.volumeC <= 49);
        require(_order.volumeQ <= 52);

        // Verify minimum volume ranges
        require(_order.minimumVolumeC <= 49);
        require(_order.minimumVolumeQ <= 52);
    }

    /**
     * @notice Verifies details about an match

     * @param _buy the buy order details
     * @param _sell the sell order details
     */
    function verifyMatch(OrderDetails _buy, OrderDetails _sell) internal pure {
        // Require that the orders are confirmed to one another
        require(_buy.parity == uint8(OrderParity.Buy));
        require(_sell.parity == uint8(OrderParity.Sell));

        // Buy price should be greater than sell price
        require(tupleGTE(_buy.priceC, _buy.priceQ, _sell.priceC, _sell.priceQ));
        
        // Buy volume should be greater than sell minimum volume
        require(tupleGTE(_buy.volumeC, _buy.volumeQ, _sell.minimumVolumeC, _sell.minimumVolumeQ));
        
        // Sell volume should be greater than buy minimum volume
        require(tupleGTE(_sell.volumeC, _sell.volumeQ, _buy.minimumVolumeC, _buy.minimumVolumeQ));
    }

    /**
     * @notice Calculates the volumes to be transferred between traders
     * (not including fees)
     */
    function settlementDetails(
        OrderDetails buy,
        OrderDetails sell,
        uint32 _buyTokenDecimals,
        uint32 _sellTokenDecimals
    ) internal pure returns (uint256, uint256) {
        // Price midpoint
        (uint256 midPriceC, int256 midPriceQ) = priceMidPoint(buy, sell);

        (uint256 minVolC, int256 minVolQ, uint256 divideC) = minimumVolume(buy, sell, midPriceC, midPriceQ);

        uint256 lowTokenValue = tupleToScaledVolume(minVolC, minVolQ, midPriceC, midPriceQ, divideC, _sellTokenDecimals);

        uint256 highTokenValue = tupleToVolume(minVolC, minVolQ, divideC, _buyTokenDecimals);

        return (lowTokenValue, highTokenValue);
    }
}