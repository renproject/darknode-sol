pragma solidity ^0.4.23;

pragma experimental ABIEncoderV2;

import "zeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract TraderWallet {
    using SafeMath for uint256;

    // TODO: Use same constant instance across all contracts 
    address ETH = 0x0;

    struct Order {
        uint16 priceC;
        uint16 priceQ;
        uint16 volumeC;
        uint16 volumeQ;
        uint16 minimumVolumeC;
        uint16 minimumVolumeQ;
        address trader;
        DetailedERC20 wantToken;
        bytes32 nonceHash;
    }

    event Deposit(address trader, address token, uint256 value);
    event Withdraw(address trader, address token, uint256 value);
    event Transfer(address from, address to, address token, uint256 value);

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


    function midPoint(uint16 buyPriceC, uint16 buyPriceQ, uint16 sellPriceC, uint16 sellPriceQ) public pure returns (uint16, uint16) {
        uint16 norm = sellPriceC * 10 ** (sellPriceQ - buyPriceQ);
        return ((buyPriceC + norm) / 2, buyPriceQ);
    }
 
    // Verifier functions //

    function submitOrder(
        uint256 id,
        uint16 priceC, uint16 priceQ, uint16 volumeC, uint16 volumeQ, uint16 minimumVolumeC, uint16 minimumVolumeQ, address trader, DetailedERC20 wantToken, uint16 nonceHash
    ) public {
        // orders[id] = Order({
        //     priceC: priceC,
        //     priceQ: priceQ,
        //     volumeC: volumeC,
        //     volumeQ: volumeQ,
        //     minimumVolumeC: minimumVolumeC,
        //     minimumVolumeQ: minimumVolumeQ,
        //     trader: trader,
        //     wantToken: wantToken,
        //     nonceHash: nonceHash
        // });
    }

    function submitMatch(
        uint256 buy, uint256 sell
    ) public {
        // TODO: Verify order match

        uint8 highDecimals = orders[buy].wantToken.decimals();
        uint8 lowDecimals = orders[sell].wantToken.decimals();

        uint16 volumeC = orders[sell].volumeC;
        uint16 volumeQ = orders[sell].volumeQ;

        uint16 midC;
        uint16 midQ;
        (midC, midQ) = midPoint(orders[buy].priceC, orders[buy].priceQ, orders[sell].priceC, orders[sell].priceQ);

        uint256 lowValue = volumeC * 2 * 10**(volumeQ + lowDecimals - 12 - 1);
        uint256 highValue = (volumeC * 2 * midC * 1) * 10*(volumeQ + (25 - midQ) + highDecimals - 12 - 1 - 1);
        
        // Subtract values
        decrementBalance(orders[buy].trader, orders[sell].wantToken, lowValue);
        decrementBalance(orders[sell].trader, orders[buy].wantToken, highValue);

        // Add values
        incrementBalance(orders[sell].trader, orders[sell].wantToken, lowValue);
        incrementBalance(orders[buy].trader, orders[buy].wantToken, highValue);

        emit Transfer(orders[buy].trader, orders[sell].trader, orders[sell].wantToken, lowValue);
        emit Transfer(orders[sell].trader, orders[buy].trader, orders[buy].wantToken, highValue);
    }
 
}