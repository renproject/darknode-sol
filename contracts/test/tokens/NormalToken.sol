pragma solidity 0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";

contract NormalToken is ERC20, ERC20Detailed {
    string private constant _name = "Normal Token";
    string private constant _symbol = "NML";
    uint8 private constant _decimals = 18;

    uint256 public constant INITIAL_SUPPLY =
        1000000000 * 10**uint256(_decimals);

    constructor() public {
        ERC20Detailed.initialize(_name, _symbol, _decimals);
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    function approve(address _spender, uint256 _value)
        public
        returns (bool success)
    {
        if ((_value != 0) && (allowance(msg.sender, _spender) != 0))
            revert("approve with previous allowance");

        return super.approve(_spender, _value);
    }
}
