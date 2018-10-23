pragma solidity ^0.4.24;

import "openzeppelin-eth/contracts/token/ERC20/ERC20.sol";

/// @notice A test ERC20 token with 12 decimals.
contract ImpreciseToken is ERC20 {

    string public constant name = "Imprecise Token"; // solium-disable-line uppercase
    string public constant symbol = "IPT"; // solium-disable-line uppercase
    uint8 public constant decimals = 9; // solium-disable-line uppercase

    uint256 public constant INITIAL_SUPPLY = 1000000000 * (10 ** uint256(decimals));

    /**
    * @dev Constructor that gives msg.sender all of existing tokens.
    */
    constructor() public {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

}