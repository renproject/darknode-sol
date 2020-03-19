pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

import "../libraries/Claimable.sol";
import "../libraries/CanReclaimTokens.sol";

/// @notice RenERC20 represents a digital asset that has been bridged on to
/// the Ethereum ledger. It exposes mint and burn functions that can only be
/// called by it's associated Gateway contract.
contract RenERC20 is ERC20, ERC20Detailed, Claimable, CanReclaimTokens {
    /* solium-disable-next-line no-empty-blocks */
    constructor(string memory _name, string memory _symbol, uint8 _decimals)
        public
        ERC20Detailed(_name, _symbol, _decimals)
    {}

    function burn(address _from, uint256 _amount) public onlyOwner {
        _burn(_from, _amount);
    }

    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
}

/// @dev The following are not necessary for deploying renBTC or renZEC contracts,
/// but are used to track deployments.

/* solium-disable-next-line no-empty-blocks */
contract renBTC is RenERC20("renBTC", "renBTC", 8) {}

/* solium-disable-next-line no-empty-blocks */
contract renZEC is RenERC20("renZEC", "renZEC", 8) {}

/* solium-disable-next-line no-empty-blocks */
contract renBCH is RenERC20("renBCH", "renBCH", 8) {}
