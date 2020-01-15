pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";

contract RenToken is Ownable, ERC20Detailed, ERC20Pausable, ERC20Burnable {

    string private constant _name = "Republic Token";
    string private constant _symbol = "REN";
    uint8 private constant _decimals = 18;

    uint256 public constant INITIAL_SUPPLY = 1000000000 * 10**uint256(_decimals);

    /// @notice The RenToken Constructor.
    constructor() ERC20Burnable() ERC20Pausable() ERC20Detailed(_name, _symbol, _decimals) public {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    function transferTokens(address beneficiary, uint256 amount) public onlyOwner returns (bool) {
        // Note: The deployed version has no revert reason
        /* solium-disable-next-line error-reason */
        require(amount > 0);

        _transfer(msg.sender, beneficiary, amount);
        emit Transfer(msg.sender, beneficiary, amount);

        return true;
    }
}
