pragma solidity ^0.4.24;

import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

import "./RenExSettlement.sol";

/**
@title The contract responsible for holding RenEx trader funds
@author Republic Protocol
*/
contract RenExBalances is Ownable {
    using SafeMath for uint256;

    RenExSettlement public settlementContract;

    // TODO: Use same constant instance across all contracts 
    address ETH = 0x0;

    // Events
    event BalanceDecreased(address trader, ERC20 token, uint256 value);
    event BalanceIncreased(address trader, ERC20 token, uint256 value);
    event RenExSettlementContractChanged(address indexed previousOwner, address indexed newOwner);

    // Storage
    mapping(address => address[]) public traderTokens;
    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => mapping(address => bool)) private activeTraderToken;

    /**
    @notice After deployment, setRenExSettlementContract should be called
    */
    constructor() public {
    }


    /********** MODIFIERS *****************************************************/                    

    /**
    @notice Throws if called by any account other than the RenExSettlement contract
    */
    modifier onlyRenExSettlementContract() {
        require(msg.sender == address(settlementContract));
        _;
    }


    /********** ONLY OWNER FUNCTIONS ******************************************/                

    /**
    @notice Updates the address of the settlement contract (can only be called
    by the owner of the contract)
    @param _newSettlementContract the address of the new settlement contract
    */
    function setRenExSettlementContract(RenExSettlement _newSettlementContract) public onlyOwner {
        emit RenExSettlementContractChanged(settlementContract, _newSettlementContract);
        settlementContract = _newSettlementContract;
    }


    /********** SETTLEMENT FUNCTIONS ******************************************/            
    
    /**
    @notice Increments a trader's balance of a token - can only be called by the
    owner, intended to be the RenEx settlement contract
    @param _trader the address of the trader
    @param _tokenCode the token's identifier
    @param _value the number of tokens to increment the balance by (in the token's smallest unit)
    */
    function incrementBalance(address _trader, address _token, uint256 _value) public onlyRenExSettlementContract {
        privateIncrementBalance(_trader, ERC20(_token), _value);
    }
    
    function privateIncrementBalance(address _trader, ERC20 _token, uint256 _value) private {
        // Check if it's the first time the trader
        if (!activeTraderToken[_trader][_token]) {
            activeTraderToken[_trader][_token] = true;
            traderTokens[_trader].push(_token);
        }

        balances[_trader][_token] = balances[_trader][_token].add(_value);
        
        emit BalanceIncreased(_trader, _token, _value);
    }

    /**
    @notice Decrements a trader's balance of a token - can only be called by the
    owner, intended to be the RenEx settlement contract
    @param _trader the address of the trader
    @param _tokenCode the token's identifier
    @param _value the number of tokens to decrement the balance by (in the token's smallest unit)
    */
    function decrementBalance(address _trader, address _token, uint256 _value) public onlyRenExSettlementContract {
        privateDecrementBalance(_trader, ERC20(_token), _value);
    }

    function privateDecrementBalance(address _trader, ERC20 _token, uint256 _value) private {
        balances[_trader][_token] = balances[_trader][_token].sub(_value);

        emit BalanceDecreased(_trader, _token, _value);
    }


    /********** TRADER FUNCTIONS **********************************************/    

    /**
    @notice Deposits ETH or an ERC20 token into the contract
    @param _tokenCode the token's identifier (must be a registered token)
    @param _value the amount to deposit in the token's smallest unit
    */
    function deposit(ERC20 _token, uint256 _value) payable public {
        address trader = msg.sender;

        if (address(_token) == ETH) {
            require(msg.value == _value);
        } else {
            require(_token.transferFrom(trader, this, _value));
        }
        privateIncrementBalance(trader, _token, _value);
    }

    /**
    @notice Withdraws ETH or an ERC20 token from the contract
    @notice TODO: Check if the account has any open orders first
    @param _tokenCode the token's identifier (doesn't have to be registered)
    @param _value the amount to withdraw in the token's smallest unit
    */
    function withdraw(ERC20 _token, uint256 _value) public {
        address trader = msg.sender;

        require(balances[trader][_token] >= _value);

        // Check if the trader is allowed to withdraw (if the settlement contract
        // is not set this won't revert)
        require(!settlementContract.isWithdrawalInvalid(trader, _token, _value));

        privateDecrementBalance(trader, _token, _value);
        if (address(_token) == ETH) {
            trader.transfer(_value);
        } else {
            require(_token.transfer(trader, _value));
        }
    }


    /********** READ-ONLY FUNCTIONS *******************************************/

    /**
    @notice Retrieves the list of token addresses that the trader has previosly
    deposited and a list of the corresponding token balances
    @param _trader the address of the trader
    @return [
        "the array of token addresses",
        "the array of token balances in tokens' smallest units"
    ]
    */
    function getBalances(address _trader) public view returns (address[], uint256[]) {
        address[] memory tokens = traderTokens[_trader];
        uint256[] memory traderBalances = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            traderBalances[i] = balances[_trader][tokens[i]];
        }

        return (tokens, traderBalances);
    }

}