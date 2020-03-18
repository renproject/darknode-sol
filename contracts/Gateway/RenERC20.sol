pragma solidity 0.5.16;

import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";

import "../libraries/Claimable.sol";
import "../libraries/CanReclaimTokens.sol";

/// @notice RenERC20 represents a digital asset that has been bridged on to
/// the Ethereum ledger. It exposes mint and burn functions that can only be
/// called by it's associated Gateway contract.
contract RenERC20 is
    Initializable,
    ERC20,
    ERC20Detailed,
    Claimable,
    CanReclaimTokens
{
    /* solium-disable-next-line no-empty-blocks */
    function initialize(
        address _nextOwner,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public initializer {
        ERC20Detailed.initialize(_name, _symbol, _decimals);
        Claimable.initialize(_nextOwner);
        CanReclaimTokens.initialize(_nextOwner);
    }

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
contract renBTC is InitializableAdminUpgradeabilityProxy {}

/* solium-disable-next-line no-empty-blocks */
contract renZEC is InitializableAdminUpgradeabilityProxy {}

/* solium-disable-next-line no-empty-blocks */
contract renBCH is InitializableAdminUpgradeabilityProxy {}
