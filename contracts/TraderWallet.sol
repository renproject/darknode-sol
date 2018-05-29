pragma solidity ^0.4.24;

// pragma experimental ABIEncoderV2;

import "zeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract TraderWallet {
    using SafeMath for uint256;

    // TODO: Use same constant instance across all contracts 
    address ETH = 0x0;

    struct Order {
        uint256 priceC;
        uint256 priceQ;
        uint256 volumeC;
        uint256 volumeQ;
        uint256 minimumVolumeC;
        uint256 minimumVolumeQ;
        address trader;
        DetailedERC20 wantToken;
        bytes32 nonceHash;
    }

    event Deposit(address trader, address token, uint256 value);
    event Withdraw(address trader, address token, uint256 value);
    event Transfer(address from, address to, address token, uint256 value);
    event Debug256(uint256 num);
    event Debugi256(int256 num);
    event Debug(string msg);

    mapping(uint256 => Order) private orders;

    mapping(address => DetailedERC20[]) private traderTokens;
    mapping(address => mapping(address => bool)) private activeTraderToken;
    mapping(address => mapping(address => uint256)) private balances;

    
    // CONSTRUCTOR //

    constructor() public {}


    
    // PRIVATE functions //
    
    function incrementBalance(address _trader, DetailedERC20 _token, uint256 _value) private {
        // Check if it's the first time the trader
        if (!activeTraderToken[_trader][_token]) {
            activeTraderToken[_trader][_token] = true;
            traderTokens[_trader].push(_token);
        }

        balances[_trader][_token] = balances[_trader][_token].add(_value);
    }

    function decrementBalance(address _trader, DetailedERC20 _token, uint256 _value) private {
        balances[_trader][_token] = balances[_trader][_token].sub(_value);
    }




    // Trader functions //

    function deposit(DetailedERC20 _token, uint256 _value) payable public {
        address trader = msg.sender;

        if (address(_token) == ETH) {
            require(msg.value == _value);
        } else {
            require(_token.transferFrom(trader, this, _value));
        }
        incrementBalance(trader, _token, _value);

        emit Deposit(trader, _token, _value);
    }

    function withdraw(DetailedERC20 _token, uint256 _value) public {
        address trader = msg.sender;

        decrementBalance(trader, _token, _value);
        if (address(_token) == ETH) {
            trader.transfer(_value);
        } else {
            require(_token.transfer(trader, _value));
        }

        emit Withdraw(trader, _token, _value);
    }

    function getBalance(address _trader, DetailedERC20 _token) public view returns (uint256) {
        return balances[_trader][_token];
    }

    function getTokens(address _trader) public view returns (DetailedERC20[]) {
        return traderTokens[_trader];
    }

    function getBalances(address _trader) public view returns (DetailedERC20[], uint256[]) {
        DetailedERC20[] memory tokens = getTokens(_trader);
        uint256[] memory traderBalances = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            traderBalances[i] = getBalance(_trader, tokens[i]);
        }

        return (tokens, traderBalances);
    }






    function submitOrder(
        uint256 id,
        uint256 priceC, uint256 priceQ, uint256 volumeC, uint256 volumeQ, uint256 minimumVolumeC, uint256 minimumVolumeQ, address trader, DetailedERC20 wantToken, bytes32 nonceHash
    ) public {
        orders[id] = Order({
            priceC: priceC,
            priceQ: priceQ,
            volumeC: volumeC,
            volumeQ: volumeQ,
            minimumVolumeC: minimumVolumeC,
            minimumVolumeQ: minimumVolumeQ,
            trader: trader,
            wantToken: wantToken,
            nonceHash: nonceHash
        });
    }


    function priceMidPoint(uint256 buyID, uint256 sellID) public view returns (uint256, uint256) {
        uint256 norm = orders[sellID].priceC * 10 ** (orders[sellID].priceQ - orders[buyID].priceQ);
        return ((orders[buyID].priceC + norm) / 2, orders[buyID].priceQ);
    }

    function minimumVolume(uint256 buyID, uint256 sellID, uint256 priceC, uint256 priceQ) public view returns (uint256, int256) {        
        uint256 buyV = tupleToRenVolume(orders[buyID].volumeC, int256(orders[buyID].volumeQ), 12);
        uint256 sellV = tupleToBTCVolume(orders[sellID].volumeC, int256(orders[sellID].volumeQ), priceC, priceQ, 12);

        if (buyV < sellV) {
            // TODO: Optimize this process, divide above
            return (orders[buyID].volumeC * 200 / priceC, int256(orders[buyID].volumeQ + 26 + 12) - int256(priceQ));
        } else {
            return (orders[sellID].volumeC, int256(orders[sellID].volumeQ));
        }
    }

    function tupleToBTCVolume(uint256 volC, int256 volQ, uint256 priceC, uint256 priceQ, uint256 decimals)
    public pure returns (uint256) {
        uint256 c = volC * 5 * priceC * 2;

        uint256 ep = priceQ + decimals;
        uint256 en = 26 + 12 + 3 + 12 + 1;
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

    function tupleToPrice(uint256 priceC, uint256 priceQ) pure public returns (uint256) {
        uint256 c = 5 * priceC;
        uint256 ep = priceQ + 8;
        uint256 en = 26 + 3 + 12;
        if (ep >= en) {
            return c * 10 ** (ep - en);
        } else {
            return c / 10 ** (en - ep);
        }
    }

    function tupleToRenVolume(uint256 volC, int256 volQ, uint256 decimals) public pure returns (uint256) {
        uint256 c = 2 * volC;
        uint256 ep = decimals;
        uint256 en = 12 + 1;
        if (volQ < 0) {
            en += uint256(-volQ);
        } else {
            ep += uint256(volQ);
        }

        if (ep >= en) {
            return c * 10 ** (ep - en);
        } else {
            return c / 10 ** (en - ep);
        }
    }

    function submitMatch(uint256 buyID, uint256 sellID) public {
        // TODO: Verify order match        

        // Price midpoint
        (uint256 midPriceC, uint256 midPriceQ) = priceMidPoint(buyID, sellID);
        
        (uint256 minVolC, int256 minVolQ) = minimumVolume(buyID, sellID, midPriceC, midPriceQ);

        uint256 btcValue = tupleToBTCVolume(minVolC, minVolQ, midPriceC, midPriceQ, 8);

        uint256 renValue = tupleToRenVolume(minVolC, minVolQ, 18);

        finalizeMatch(buyID, sellID, btcValue, renValue);
    }


    // Ensure this remains private
    function finalizeMatch(uint256 buyID, uint256 sellID, uint256 btcValue, uint256 renValue) private {

        // Subtract values
        decrementBalance(orders[buyID].trader, orders[sellID].wantToken, btcValue);
        decrementBalance(orders[sellID].trader, orders[buyID].wantToken, renValue);

        // Add values
        incrementBalance(orders[sellID].trader, orders[sellID].wantToken, btcValue);
        incrementBalance(orders[buyID].trader, orders[buyID].wantToken, renValue);

        emit Transfer(orders[buyID].trader, orders[sellID].trader, orders[sellID].wantToken, btcValue);
        emit Transfer(orders[sellID].trader, orders[buyID].trader, orders[buyID].wantToken, renValue);
    }
 
}