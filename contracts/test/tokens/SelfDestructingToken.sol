pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";

/// @notice A test ERC20 token that can destroy itself.
contract SelfDestructingToken is StandardToken, Ownable {

    string public constant name = "Self Destructing Token";
    string public constant symbol = "SDT";
    uint8 public constant decimals = 18;
    uint256 public constant INITIAL_SUPPLY = 1000000000 * 10**uint256(decimals);

    /// @notice The RenToken Constructor.
    constructor() public {
        totalSupply_ = INITIAL_SUPPLY;
        balances[msg.sender] = INITIAL_SUPPLY;
    }

    function destruct() public onlyOwner {
        selfdestruct(owner);
    }
}