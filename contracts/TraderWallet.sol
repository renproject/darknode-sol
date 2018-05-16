pragma solidity ^0.4.23;

pragma experimental ABIEncoderV2;

import "zeppelin-solidity/contracts/token/ERC20/DetailedERC20.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract TraderWallet is Ownable {
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


    function midPoint(Order buy, Order sell) public pure returns (uint16, uint16) {
        uint16 norm = sell.priceC * 10 ** (sell.priceQ - buy.priceQ);
        return ((buy.priceC + norm) / 2, buy.priceQ);
    }

    // Verifier functions //

    function rebalance(Order buy, Order sell) public {
        // TODO: Verify order match

        uint8 highDecimals = 8;
        uint8 lowDecimals = 18;

        uint16 volumeC = sell.volumeC;
        uint16 volumeQ = sell.volumeQ;

        uint16 midC;
        uint16 midQ;
        (midC, midQ) = midPoint(buy, sell);

        uint256 lowValue = volumeC * 2 * 10**(volumeQ + lowDecimals - 12 - 1);
        uint256 highValue = (volumeC * 2 * midC * 1) * 10*(volumeQ + (25 - midQ) + highDecimals - 12 - 1 - 1);
        
        // Subtract values
        decrementBalance(buy.trader, sell.wantToken, lowValue);
        decrementBalance(sell.trader, buy.wantToken, highValue);

        // Add values
        incrementBalance(sell.trader, sell.wantToken, lowValue);
        incrementBalance(buy.trader, buy.wantToken, highValue);

        emit Transfer(buy.trader, sell.trader, sell.wantToken, lowValue);
        emit Transfer(sell.trader, buy.trader, buy.wantToken, highValue);
    }
 
}