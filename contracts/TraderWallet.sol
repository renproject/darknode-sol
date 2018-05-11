pragma solidity ^0.4.23;

import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract TraderWallet is Ownable {
    using SafeMath for uint256;

    event Deposit(address trader, address token, uint256 value);

    mapping(address => ERC20[]) private traderTokens;
    mapping(address => mapping(address => bool)) private activeTraderToken;
    mapping(address => mapping(address => uint256)) private balances;

    
    // PRIVATE functions //
    
    function incrementBalance(address _trader, ERC20 _token, uint256 _value) private {
        // Check if it's the first time the trader
        if (!activeTraderToken[_trader][_token]) {
            activeTraderToken[_trader][_token] = true;
            traderTokens[_trader].push(_token);
        }

        balances[_trader][_token] = balances[_trader][_token].add(_value);
    }

    function decrementBalance(address _trader, ERC20 _token, uint256 _value) private {
        balances[_trader][_token] = balances[_trader][_token].sub(_value);
    }




    // Trader functions //

    function deposit(ERC20 _token, uint256 _value) public {
        address trader = msg.sender;

        require(_token.transferFrom(trader, this, _value));
        incrementBalance(trader, _token, _value);
    }

    function withdraw(ERC20 _token, uint256 _value) public {
        address trader = msg.sender;

        decrementBalance(trader, _token, _value);
        require(_token.transfer(trader, _value));
    }

    function getBalance(address _trader, ERC20 _token) public view returns (uint256) {
        return balances[_trader][_token];
    }

    function getTokens(address _trader) public view returns (ERC20[]) {
        return traderTokens[_trader];
    }

    function getBalances(address _trader) public view returns (ERC20[], uint256[]) {
        ERC20[] memory tokens = traderTokens[_trader];
        uint256[] memory traderBalances = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            traderBalances[i] = balances[_trader][tokens[i]];
        }

        return (tokens, traderBalances);
    }




    // Verifier functions //

    function rebalance(
        ERC20 _tokenFromTraderA, address _traderA, uint256 _tokenAValue,
        ERC20 _tokenFromTraderB, address _traderB, uint256 _tokenBValue)
        public
    {
        // TODO: Verify order match
        
        // Subtract values
        decrementBalance(_traderA, _tokenFromTraderA, _tokenAValue);
        decrementBalance(_traderB, _tokenFromTraderB, _tokenBValue);

        // Add values
        incrementBalance(_traderA, _tokenFromTraderB, _tokenBValue);
        incrementBalance(_traderB, _tokenFromTraderA, _tokenAValue);
    }
 
}