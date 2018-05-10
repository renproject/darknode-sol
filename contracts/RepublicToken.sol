pragma solidity ^0.4.23;

import "zeppelin-solidity/contracts/token/ERC20/PausableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";

contract RepublicToken is PausableToken, BurnableToken {

    string public constant name = "Republic Token";
    string public constant symbol = "REN";
    uint8 public constant decimals = 18;
    uint256 public constant INITIAL_SUPPLY = 1000000000 * 10**uint256(decimals);
    uint256 public totalSupply;
    
    /**
      * @notice The RepublicToken Constructor.
      */
    constructor() public {
        totalSupply = INITIAL_SUPPLY;   
        balances[msg.sender] = INITIAL_SUPPLY;
    }

    function transferTokens(address beneficiary, uint256 amount) public onlyOwner returns (bool) {
        require(amount > 0);

        balances[owner] = balances[owner].sub(amount);
        balances[beneficiary] = balances[beneficiary].add(amount);
        emit Transfer(owner, beneficiary, amount);

        return true;
    }

    function transfer(address _to, uint256 _value) public whenNotPaused returns (bool) {
        // Do not allow sending REN to this contract
        require(_to != address(this));
        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint256 _value) public whenNotPaused returns (bool) {
        // Do not allow sending REN to this contract
        require(_to != address(this));
        return super.transferFrom(_from, _to, _value);
    }
}
