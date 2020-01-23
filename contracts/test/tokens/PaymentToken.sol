pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";

contract PaymentToken is ERC20Pausable, ERC20Burnable, ERC20Detailed {

    string private constant _name = "PaymentToken";
    string private constant _symbol = "PAYT";
    uint8 private constant _decimals = 18;

    uint256 public constant INITIAL_SUPPLY = 1000000000 * 10**uint256(_decimals);

    /// @notice The RenToken Constructor.
    constructor() ERC20Burnable() ERC20Pausable() ERC20Detailed(_name, _symbol, _decimals) public {
        _mint(msg.sender, INITIAL_SUPPLY);
    }
}
