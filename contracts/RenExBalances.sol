pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

import "./RenLedger.sol";

/**
@title The contract responsible for holding RenEx trader funds
@author Republic Protocol
*/
contract RenExBalances is Ownable {
    using SafeMath for uint256;

    // TODO: Use same constant instance across all contracts 
    address ETH = 0x0;

    address public traderAccountsContract = 0x0;

    // Events
    event BalanceDecreased(address trader, uint32 token, uint256 value);
    event BalanceIncreased(address trader, uint32 token, uint256 value);
    event TraderAccountsContractChanged(address indexed previousOwner, address indexed newOwner);


    mapping(address => uint32[]) private traderTokens;
    mapping(address => mapping(uint32 => bool)) private activeTraderToken;
    mapping(address => mapping(uint32 => uint256)) private balances;


    /**
    @notice constructor placeholder
    */
    constructor() public {
    }

    /**
    * @notice Throws if called by any account other than the TraderAccounts contract
    */
    modifier onlyTraderAccountsContract() {
        require(msg.sender == traderAccountsContract);
        _;
    }

    function setTraderAccountsContract(address _newTraderAccountsContract) public onlyOwner {
        emit TraderAccountsContractChanged(traderAccountsContract, _newTraderAccountsContract);
        traderAccountsContract = _newTraderAccountsContract;
    }
    
    /**
    @notice Increments a trader's balance of a token - can only be called by the
    owner, intended to be the RenEx settlement contract
    @param _trader the address of the trader
    @param _tokenCode the token's identifier
    @param _value the number of tokens to increment the balance by (in the token's smallest unit)
    */
    function incrementBalance(address _trader, uint32 _tokenCode, uint256 _value) public onlyTraderAccountsContract {
        // Check if it's the first time the trader
        if (!activeTraderToken[_trader][_tokenCode]) {
            activeTraderToken[_trader][_tokenCode] = true;
            traderTokens[_trader].push(_tokenCode);
        }

        balances[_trader][_tokenCode] = balances[_trader][_tokenCode].add(_value);
    }

    /**
    @notice Decrements a trader's balance of a token - can only be called by the
    owner, intended to be the RenEx settlement contract
    @param _trader the address of the trader
    @param _tokenCode the token's identifier
    @param _value the number of tokens to decrement the balance by (in the token's smallest unit)
    */
    function decrementBalance(address _trader, uint32 _tokenCode, uint256 _value) public onlyTraderAccountsContract {
        balances[_trader][_tokenCode] = balances[_trader][_tokenCode].sub(_value);
    }


    /**
    @notice Retrieves a trader's balance for a token
    @param _trader the address of the trader to retrieve the balance of
    @param _tokenCode the token's identifier (doesn't have to be registered)
    @return the trader's balance in the token's smallest unit
    */
    function getBalance(address _trader, uint32 _tokenCode) public view returns (uint256) {    
        return balances[_trader][_tokenCode];
    }

    /**
    @notice Retrieves the list of token addresses that the trader has previously
    deposited
    @param _trader the address of the trader
    @return an array of addresses of the tokens
    */
    function getTokens(address _trader) public view returns (uint32[]) {
        return traderTokens[_trader];
    }

    /**
    @notice Retrieves the list of token addresses that the trader has previosly
    deposited and a list of the corresponding token balances
    @param _trader the address of the trader
    @return [
        "the array of token addresses",
        "the array of token balances in tokens' smallest units"
    ]
    */
    function getBalances(address _trader) public view returns (uint32[], uint256[]) {
        uint32[] memory tokens = getTokens(_trader);
        uint256[] memory traderBalances = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            traderBalances[i] = getBalance(_trader, tokens[i]);
        }

        return (tokens, traderBalances);
    }

}