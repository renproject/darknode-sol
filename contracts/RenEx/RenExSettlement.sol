pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

import "../RenLedger.sol";
import "./RenExBalances.sol";
import "./RenExTokens.sol";

/**
@title The contract responsible for holding trader funds and settling matched
order values
@author Republic Protocol
*/
contract RenExSettlement is Ownable {
    using SafeMath for uint256;

    RenLedger renLedgerContract;
    RenExTokens renExTokensContract;
    RenExBalances renExBalancesContract;

    enum OrderType {Midpoint, Limit}
    enum OrderParity {Buy, Sell}
    enum OrderStatus {None, Submitted, Matched}

    struct Order {
        uint8 parity;
        uint8 orderType;
        uint64 expiry;
        uint64 tokens;        
        uint256 priceC; uint256 priceQ;
        uint256 volumeC; uint256 volumeQ;
        uint256 minimumVolumeC; uint256 minimumVolumeQ;
        uint256 nonceHash;
        address trader;
    }

    struct Match {
        uint256 price;
        uint256 lowVolume;
        uint256 highVolume;
    }

    // Events
    event Transfer(address from, address to, uint32 token, uint256 value);
    event Debug256(string msg, uint256 num);
    event Debugi256(string msg, int256 num);
    event Debug(string msg);
    event DebugTuple(string msg, uint256 c, uint256 q);
    event DebugTupleI(string msg, uint256 c, int256 q);


    // Storage
    mapping(bytes32 => Order) public orders;
    mapping(bytes32 => OrderStatus) private orderStatuses;
    mapping(bytes32 => Match) public matches;

    /**
    @notice constructor
    @param _renLedgerContract the address of the RenLedger contract
    @param _renExBalancesContract the address of the RenExBalances contract
    @param _renExTokensContract the address of the RenExTokens contract
    */
    constructor(RenLedger _renLedgerContract, RenExTokens _renExTokensContract, RenExBalances _renExBalancesContract) public {
        renLedgerContract = _renLedgerContract;
        renExTokensContract = _renExTokensContract;
        renExBalancesContract = _renExBalancesContract;
    }


    /********** WITHDRAWAL FUNCTIONS ******************************************/

    function traderCanWithdraw(address _trader, address _token, uint256 amount) public returns (bool) {
        // In the future, this will return true (i.e. invalid withdrawal) if the
        // trader has open orders for that token
        return true;
    }



    /********** SETTLEMENT FUNCTIONS ******************************************/
    
    // Price/volume calculation functions

    function priceMidPoint(bytes32 buyID, bytes32 sellID) private view returns (uint256, int256) {
        // Normalize to same exponent before finding mid-point (mean)
        // Common exponent is 0 (to ensure division doesn't lose details)
        // uint256 norm1 = orders[buyID].priceC * 10 ** (orders[buyID].priceQ);
        // uint256 norm2 = orders[sellID].priceC * 10 ** (orders[sellID].priceQ);
        // return ((norm1 + norm2) / 2, 0);
        uint256 norm = orders[buyID].priceC * 10 ** (orders[buyID].priceQ - orders[sellID].priceQ);
        int256 q = int256(orders[sellID].priceQ);
        // To not lose the .5 for odd numbers, multiply by 5 and subtract from q
        return ((orders[sellID].priceC + norm) * (10 / 2), q - 1);
    }

    function minimumVolume(bytes32 buyID, bytes32 sellID, uint256 priceC, int256 priceQ) private view returns (uint256, int256) {        
        uint256 buyV = tupleToVolume(orders[buyID].volumeC, int256(orders[buyID].volumeQ), 12);
        uint256 sellV = tupleToScaledVolume(orders[sellID].volumeC, int256(orders[sellID].volumeQ), priceC, priceQ, 12);

        // emit Debug256("BuyV", buyV);
        // emit Debug256("SellV", sellV);

        if (buyV < sellV) {
            // TODO: Optimize this process, divide above
            // FIXME: This loses precision when dividing by priceC.
            // As a temporary solution, we multiply by 100 and subtract 2 from
            // the exponent. We could improve this by shifting by the entire
            // exponent as long as the constant doesn't overflow.
            return (orders[buyID].volumeC * 200 * 100 / priceC, int256(orders[buyID].volumeQ + 26 + 12) - priceQ - 2);
        } else {
            return (orders[sellID].volumeC, int256(orders[sellID].volumeQ));
        }
    }

    function tupleToScaledVolume(uint256 volC, int256 volQ, uint256 priceC, int256 priceQ, uint256 decimals)
    private pure returns (uint256) {
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

        return value;
    }

    function tupleToPrice(uint256 priceC, int256 priceQ, uint256 decimals)
    private pure returns (uint256) {
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


    function tupleToVolume(uint256 volC, int256 volQ, uint256 decimals) private pure returns (uint256) {
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
        if (ep >= en) {
            return c * 10 ** (ep - en);
        } else {
            return c / 10 ** (en - ep);
        }
    }

    // Ensure this remains private
    function finalizeMatch(
        address buyer, address seller,
        uint32 buyToken, uint32 sellToken,
        uint256 lowTokenValue, uint256 highTokenValue
    ) private {
        address buyTokenAddress = renExTokensContract.tokenAddresses(buyToken);        
        address sellTokenAddress = renExTokensContract.tokenAddresses(sellToken);

        // Subtract values
        renExBalancesContract.decrementBalance(buyer, sellTokenAddress, lowTokenValue);
        renExBalancesContract.decrementBalance(seller, buyTokenAddress, highTokenValue);

        // Add values
        renExBalancesContract.incrementBalance(seller, sellTokenAddress, lowTokenValue);
        renExBalancesContract.incrementBalance(buyer, buyTokenAddress, highTokenValue);

        emit Transfer(buyer, seller, sellToken, lowTokenValue);
        emit Transfer(seller, buyer, buyToken, highTokenValue);
    }



    // // TODO: Implement
    // function hashOrder(Order order) private pure returns (bytes32) {
    //     return keccak256(
    //         abi.encodePacked(
    //             order.orderType,
    //             order.parity,
    //             order.expiry,
    //             order.tokens,
    //             order.priceC, order.priceQ,
    //             order.volumeC, order.volumeQ,
    //             order.minimumVolumeC, order.minimumVolumeQ,
    //             order.nonceHash
    //         )
    //     );
    // }




    /**
    @notice Stores the details of an order
    @param _id (TODO: calculate based on other parameters)
    @param _orderType one of Midpoint or Limit
    @param _parity one of Buy or Sell
    @param _expiry the expiry date of the order in seconds since Unix epoch
    @param _tokens two 32-bit token codes concatenated (with the lowest first)
    @param _priceC the constant in the price tuple
    @param _priceQ the exponent in the price tuple
    @param _volumeC the constant in the volume tuple
    @param _volumeQ the exponent in the volume tuple
    @param _minimumVolumeC the constant in the minimum-volume tuple
    @param _minimumVolumeQ the exponent in the minimum-volume tuple
    @param _nonceHash the keccak256 hash of a random 32 byte value
    */
    function submitOrder(
        bytes32 _id,
        uint8 _orderType,
        uint8 _parity,
        uint64 _expiry,
        uint64 _tokens,
        uint16 _priceC, uint16 _priceQ,
        uint16 _volumeC, uint16 _volumeQ,
        uint16 _minimumVolumeC, uint16 _minimumVolumeQ,
        uint256 _nonceHash
    ) public {

        Order memory order = Order({
            orderType: _orderType,
            parity: _parity,
            expiry: _expiry,
            tokens: _tokens,
            priceC: _priceC, priceQ: _priceQ,
            volumeC: _volumeC, volumeQ: _volumeQ,
            minimumVolumeC: _minimumVolumeC, minimumVolumeQ: _minimumVolumeQ,
            nonceHash: _nonceHash,
            trader: 0x0 // Set after ID is calculated
        });

        // FIXME: Implement order hashing
        // bytes32 id = hashOrder(order);

        require(orderStatuses[_id] == OrderStatus.None);
        orderStatuses[_id] = OrderStatus.Submitted;

        order.trader = renLedgerContract.orderTrader(_id);


        orders[_id] = order;
    }

    function verifyMatch(bytes32 _buyID, bytes32 _sellID) public view returns (uint32, uint32) {
        require(orderStatuses[_buyID] == OrderStatus.Submitted);
        require(orderStatuses[_sellID] == OrderStatus.Submitted);

        // Require that the orders are confirmed to one another
        require(orders[_buyID].parity == uint8(OrderParity.Buy));
        require(orders[_sellID].parity == uint8(OrderParity.Sell));
        require(renLedgerContract.orderState(_buyID) == 2);
        require(renLedgerContract.orderState(_sellID) == 2);
        
        // TODO: Loop through and check at all indices
        require(renLedgerContract.orderMatch(_buyID)[0] == _sellID);

        uint32 buyToken = uint32(orders[_sellID].tokens);
        uint32 sellToken = uint32(orders[_sellID].tokens >> 32);

        require(renExTokensContract.tokenIsRegistered(buyToken));
        require(renExTokensContract.tokenIsRegistered(sellToken));
    }

    /**
    @notice Settles two orders that are matched. `submitOrder` must have been
    called for each order before this function is called
    @param _buyID the 32 byte ID of the buy order
    @param _sellID the 32 byte ID of the sell order
    */
    function submitMatch(bytes32 _buyID, bytes32 _sellID) public {
        // Verify match
        verifyMatch(_buyID, _sellID);

        uint32 buyToken = uint32(orders[_sellID].tokens);
        uint32 sellToken = uint32(orders[_sellID].tokens >> 32);

        orderStatuses[_buyID] = OrderStatus.Matched;
        orderStatuses[_sellID] = OrderStatus.Matched;

        uint32 buyTokenDecimals = renExTokensContract.tokenDecimals(buyToken);
        uint32 sellTokenDecimals = renExTokensContract.tokenDecimals(sellToken);

        // Price midpoint
        (uint256 midPriceC, int256 midPriceQ) = priceMidPoint(_buyID, _sellID);

        (uint256 minVolC, int256 minVolQ) = minimumVolume(_buyID, _sellID, midPriceC, midPriceQ);

        uint256 lowTokenValue = tupleToScaledVolume(minVolC, minVolQ, midPriceC, midPriceQ, sellTokenDecimals);

        uint256 highTokenValue = tupleToVolume(minVolC, minVolQ, buyTokenDecimals);

        finalizeMatch(orders[_buyID].trader, orders[_sellID].trader, buyToken, sellToken, lowTokenValue, highTokenValue);

        matches[keccak256(abi.encodePacked(_buyID, _sellID))] = Match({
            price: tupleToPrice(midPriceC, midPriceQ, sellTokenDecimals),
            lowVolume: lowTokenValue,
            highVolume: highTokenValue
        });
    }
}