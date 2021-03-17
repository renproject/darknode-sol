pragma solidity 0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Pausable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Burnable.sol";

contract RenToken is Ownable, ERC20Detailed, ERC20Pausable, ERC20Burnable {
    string private constant _name = "REN";
    string private constant _symbol = "REN";
    uint8 private constant _decimals = 18;

    uint256 public constant INITIAL_SUPPLY =
        1000000000 * 10**uint256(_decimals);

    /// @notice The RenToken Constructor.
    constructor() public {
        ERC20Pausable.initialize(msg.sender);
        ERC20Detailed.initialize(_name, _symbol, _decimals);
        Ownable.initialize(msg.sender);
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    function transferTokens(address beneficiary, uint256 amount)
        public
        onlyOwner
        returns (bool)
    {
        // Note: The deployed version has no revert reason
        /* solium-disable-next-line error-reason */
        require(amount > 0);

        _transfer(msg.sender, beneficiary, amount);
        emit Transfer(msg.sender, beneficiary, amount);

        return true;
    }
}
