pragma solidity 0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Pausable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Burnable.sol";

contract PaymentToken is ERC20Pausable, ERC20Burnable, ERC20Detailed {
    uint8 private constant _decimals = 18;

    uint256 public constant INITIAL_SUPPLY =
        1000000000 * 10**uint256(_decimals);

    constructor(string memory symbol) public {
        ERC20Pausable.initialize(msg.sender);
        ERC20Detailed.initialize(symbol, symbol, _decimals);
        _mint(msg.sender, INITIAL_SUPPLY);
    }
}
