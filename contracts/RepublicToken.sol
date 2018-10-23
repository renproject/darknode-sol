pragma solidity ^0.4.24;

import "openzeppelin-eth/contracts/token/ERC20/ERC20Pausable.sol";
import "openzeppelin-eth/contracts/token/ERC20/ERC20Burnable.sol";
// import "openzeppelin-eth/contracts/token/ERC20/ERC20.sol";

import "openzeppelin-eth/contracts/ownership/Ownable.sol";

contract RepublicToken is ERC20Pausable, ERC20Burnable, Ownable {

    string public constant name = "Republic Token";
    string public constant symbol = "REN";
    uint8 public constant decimals = 18;
    uint256 public constant INITIAL_SUPPLY = 1000000000 * 10**uint256(decimals);

    /// @notice The RepublicToken Constructor.
    constructor() public {
        Ownable.initialize(msg.sender);
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    // function transferTokens(address beneficiary, uint256 amount) public onlyOwner returns (bool) {
    //     return ERC20.transfer(beneficiary, amount);
    // }
}
