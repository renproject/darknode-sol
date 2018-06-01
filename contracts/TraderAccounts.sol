pragma solidity ^0.4.24;

// pragma experimental ABIEncoderV2;

import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

import "./RenLedger.sol";

contract TraderAccounts is Ownable {
    using SafeMath for uint256;

    RenLedger ledger;

    enum OrderType {Midpoint, Limit}
    enum OrderParity {Buy, Sell}

    // TODO: Use same constant instance across all contracts 
    address ETH = 0x0;

    struct Order {
        uint8 parity;
        uint8 orderType;
        uint64 expiry;
        uint64 tokens;        
        uint256 priceC; uint256 priceQ;
        uint256 volumeC; uint256 volumeQ;
        uint256 minimumVolumeC; uint256 minimumVolumeQ;
        uint256 nonceHash;
    }

    event Deposit(address trader, uint32 token, uint256 value);
    event Withdraw(address trader, uint32 token, uint256 value);
    event Transfer(address from, address to, uint32 token, uint256 value);
    event Debug256(uint256 num);
    event Debugi256(int256 num);
    event Debug(string msg);

    mapping(bytes32 => Order) private orders;

    mapping(address => uint32[]) private traderTokens;
    mapping(address => mapping(uint32 => bool)) private activeTraderToken;
    mapping(address => mapping(uint32 => uint256)) private balances;

    mapping(uint32 => ERC20) public tokenAddresses;
    mapping(uint32 => uint8) public tokenDecimals;
    mapping(uint32 => bool) public tokenEnabled;
    
    // CONSTRUCTOR //

    constructor(RenLedger _ledger) public {
        ledger = _ledger;
    }


    // Contract Registry //
    modifier onlyEnabledToken(uint32 _tokenCode) {
        require(tokenEnabled[_tokenCode]);
        _;
    }

    function registerToken(uint32 _tokenCode, ERC20 _tokenAddress, uint8 _tokenDecimals) public onlyOwner {
        tokenAddresses[_tokenCode] = _tokenAddress;
        tokenDecimals[_tokenCode] = _tokenDecimals;
        tokenEnabled[_tokenCode] = true;
    }

    function deregisterToken(uint32 _tokenCode) public onlyOwner {
        tokenEnabled[_tokenCode] = false;
    }



    // PRIVATE functions //
    
    function incrementBalance(address _trader, uint32 _tokenCode, uint256 _value) private {
        // Check if it's the first time the trader
        if (!activeTraderToken[_trader][_tokenCode]) {
            activeTraderToken[_trader][_tokenCode] = true;
            traderTokens[_trader].push(_tokenCode);
            emit Debug256(_tokenCode);
        }

        balances[_trader][_tokenCode] = balances[_trader][_tokenCode].add(_value);
    }

    function decrementBalance(address _trader, uint32 _tokenCode, uint256 _value) private {
        balances[_trader][_tokenCode] = balances[_trader][_tokenCode].sub(_value);
    }




    // Trader functions //

    function deposit(uint32 _tokenCode, uint256 _value) payable public onlyEnabledToken(_tokenCode) {
        address trader = msg.sender;

        ERC20 token = tokenAddresses[_tokenCode];

        if (address(token) == ETH) {
            require(msg.value == _value);
        } else {
            require(token.transferFrom(trader, this, _value));
        }
        incrementBalance(trader, _tokenCode, _value);

        emit Deposit(trader, _tokenCode, _value);
    }

    function withdraw(uint32 _tokenCode, uint256 _value) public {
        address trader = msg.sender;

        ERC20 token = tokenAddresses[_tokenCode];

        decrementBalance(trader, _tokenCode, _value);
        if (address(token) == ETH) {
            trader.transfer(_value);
        } else {
            require(token.transfer(trader, _value));
        }

        emit Withdraw(trader, _tokenCode, _value);
    }

    function getBalance(address _trader, uint32 _tokenCode) public view returns (uint256) {    
        return balances[_trader][_tokenCode];
    }

    function getTokens(address _trader) public view returns (uint32[]) {
        return traderTokens[_trader];
    }

    function getBalances(address _trader) public view returns (uint32[], uint256[]) {
        uint32[] memory tokens = getTokens(_trader);
        uint256[] memory traderBalances = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            traderBalances[i] = getBalance(_trader, tokens[i]);
        }

        return (tokens, traderBalances);
    }



    // Price/volume calculation functions

    function priceMidPoint(bytes32 buyID, bytes32 sellID) private view returns (uint256, uint256) {
        // Normalize to same exponent before finding mid-point (mean)
        uint256 norm = orders[sellID].priceC * 10 ** (orders[sellID].priceQ - orders[buyID].priceQ);
        return ((orders[buyID].priceC + norm) / 2, orders[buyID].priceQ);
    }

    function minimumVolume(bytes32 buyID, bytes32 sellID, uint256 priceC, uint256 priceQ) private view returns (uint256, int256) {        
        uint256 buyV = tupleToVolume(orders[buyID].volumeC, int256(orders[buyID].volumeQ), 12);
        uint256 sellV = tupleToScaledVolume(orders[sellID].volumeC, int256(orders[sellID].volumeQ), priceC, priceQ, 12);

        if (buyV < sellV) {
            // TODO: Optimize this process, divide above
            return (orders[buyID].volumeC * 200 / priceC, int256(orders[buyID].volumeQ + 26 + 12) - int256(priceQ));
        } else {
            return (orders[sellID].volumeC, int256(orders[sellID].volumeQ));
        }
    }

    function tupleToScaledVolume(uint256 volC, int256 volQ, uint256 priceC, uint256 priceQ, uint256 decimals)
    private pure returns (uint256) {
        // 0.2 turns into 2 * 10**-1 (-1 moved to exponent)
        // 0.005 turns into 5 * 10**-3 (-3 moved to exponent)
        uint256 c = volC * 5 * priceC * 2;

        // Positive and negative components of exponent
        uint256 ep = priceQ + decimals;
        uint256 en = 26 + 12 + 3 + 12 + 1;
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

        return value;
    }

    // function tupleToPrice(uint256 priceC, uint256 priceQ) pure public returns (uint256) {
    //     // 0.005 turns into 5 * 10**-3 (-3 moved to exponent)
    //     uint256 c = 5 * priceC;

    //     // Positive and negative components of exponent        
    //     uint256 ep = priceQ + 8;
    //     uint256 en = 26 + 3 + 12;

    //     // If (ep-en) is negative, divide instead of multiplying        
    //     if (ep >= en) {
    //         return c * 10 ** (ep - en);
    //     } else {
    //         return c / 10 ** (en - ep);
    //     }
    // }

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
        // Subtract values
        decrementBalance(buyer, sellToken, lowTokenValue);
        decrementBalance(seller, buyToken, highTokenValue);

        // Add values
        incrementBalance(seller, sellToken, lowTokenValue);
        incrementBalance(buyer, buyToken, highTokenValue);

        emit Transfer(buyer, seller, sellToken, lowTokenValue);
        emit Transfer(seller, buyer, buyToken, highTokenValue);
    }



    // // Not used yet
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




    function submitOrder(
        bytes32 id,
        uint8 orderType,
        uint8 parity,
        uint64 expiry,
        uint64 tokens,
        uint16 priceC, uint16 priceQ,
        uint16 volumeC, uint16 volumeQ,
        uint16 minimumVolumeC, uint16 minimumVolumeQ,
        uint256 nonceHash
    ) public {

        Order memory order = Order({
            orderType: orderType,
            parity: parity,
            expiry: expiry,
            tokens: tokens,
            priceC: priceC, priceQ: priceQ,
            volumeC: volumeC, volumeQ: volumeQ,
            minimumVolumeC: minimumVolumeC, minimumVolumeQ: minimumVolumeQ,
            nonceHash: nonceHash
        });

        // FIXME: Implement order hashing
        // bytes32 id = hashOrder(order);

        orders[id] = order;
    }


    function submitMatch(bytes32 buyID, bytes32 sellID) public {
        // TODO: Verify order match

        // Require that the orders are confirmed to one another
        require(orders[buyID].parity == uint8(OrderParity.Buy));
        require(orders[sellID].parity == uint8(OrderParity.Sell));
        require(ledger.orderState(buyID) == 2);
        require(ledger.orderState(sellID) == 2);
        
        // TODO: Loop through and check at all indices
        require(ledger.orderMatch(buyID)[0] == sellID);

        address buyer = ledger.orderTrader(buyID);
        address seller = ledger.orderTrader(sellID);

        uint32 buyToken = uint32(orders[sellID].tokens);
        uint32 sellToken = uint32(orders[sellID].tokens >> 32);

        // Price midpoint
        (uint256 midPriceC, uint256 midPriceQ) = priceMidPoint(buyID, sellID);
        
        (uint256 minVolC, int256 minVolQ) = minimumVolume(buyID, sellID, midPriceC, midPriceQ);

        uint256 lowTokenValue = tupleToScaledVolume(minVolC, minVolQ, midPriceC, midPriceQ, tokenDecimals[sellToken]);

        uint256 highTokenValue = tupleToVolume(minVolC, minVolQ, tokenDecimals[buyToken]);

        finalizeMatch(buyer, seller, buyToken, sellToken, lowTokenValue, highTokenValue);
    }

}