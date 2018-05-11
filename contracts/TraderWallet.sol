pragma solidity ^0.4.23;

import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract TraderWallet is Ownable {
    using SafeMath for uint256;

    event Deposit(address trader, address token, uint256 value);

    mapping(address => mapping(address => uint256)) balances;


    // Trader functions //

    function deposit(ERC20 _token, uint256 value) public {
        address trader = msg.sender;

        require(_token.transferFrom(trader, this, value));
        balances[trader][_token] = balances[trader][_token].add(value);
    }

    function withdraw(ERC20 _token, uint256 value) public {
        address trader = msg.sender;

        balances[trader][_token] = balances[trader][_token].sub(value);
        require(_token.transfer(trader, value));
    }


    // Verifier functions //

    function rebalance(
        ERC20 _tokenFromTraderA, address _traderA, uint256 _tokenAValue,
        ERC20 _tokenFromTraderB, address _traderB, uint256 _tokenBValue)
        public
    {
        // TODO: Verify order match
        
        // Subtract values
        balances[_traderA][_tokenFromTraderA] = balances[_traderA][_tokenFromTraderA].sub(_tokenAValue);
        balances[_traderB][_tokenFromTraderB] = balances[_traderB][_tokenFromTraderB].sub(_tokenBValue);

        // Add values
        balances[_traderA][_tokenFromTraderB] = balances[_traderA][_tokenFromTraderB].add(_tokenBValue);        
        balances[_traderB][_tokenFromTraderA] = balances[_traderB][_tokenFromTraderA].add(_tokenAValue);
    }
 
}