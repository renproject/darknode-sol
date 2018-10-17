pragma solidity ^0.4.24;

import "openzeppelin-zos/contracts/token/ERC20/StandardToken.sol";

contract TokenWithFees is StandardToken {

    string public constant name = "Token With Fees";
    string public constant symbol = "TWF";
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

    function transfer(address to, uint256 value) public returns (bool) {
        uint256 fee = (value * 3) / 1000;
        balances[msg.sender] = balances[msg.sender].sub(fee);
        return super.transfer(to, value - fee);
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        uint256 fee = (value * 3) / 1000;
        bool ret = super.transferFrom(from, to, value);
        balances[to] = balances[to].sub(fee);
        return ret;
    }
}
