pragma solidity ^0.4.24;

import "openzeppelin-zos/contracts/token/ERC20/StandardToken.sol";

/// @notice A test ERC20 token with 12 decimals.
contract ImpreciseToken is StandardToken {

    string public constant name = "Imprecise Token"; // solium-disable-line uppercase
    string public constant symbol = "IPT"; // solium-disable-line uppercase
    uint8 public constant decimals = 9; // solium-disable-line uppercase

    uint256 public constant INITIAL_SUPPLY = 1000000000 * (10 ** uint256(decimals));

    /**
    * @dev Constructor that gives msg.sender all of existing tokens.
    */
    constructor() public {
        totalSupply_ = INITIAL_SUPPLY;
        balances[msg.sender] = INITIAL_SUPPLY;
        emit Transfer(0x0, msg.sender, INITIAL_SUPPLY);
    }

}