pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";

contract NormalToken is StandardToken {

    string public constant name = "Normal Token";
    string public constant symbol = "NML";
    uint8 public constant decimals = 18;
    uint256 public constant INITIAL_SUPPLY = 1000000000 * 10**uint256(decimals);

    constructor() public {
        totalSupply_ = INITIAL_SUPPLY;
        balances[msg.sender] = INITIAL_SUPPLY;
    }

    function approve(address _spender, uint256 _value) public returns (bool success) {
        if ((_value != 0) && (allowed[msg.sender][_spender] != 0)) revert("approve with previous allowance");

        return super.approve(_spender, _value);
    }
}
