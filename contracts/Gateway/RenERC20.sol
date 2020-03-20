pragma solidity 0.5.16;

import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";

import "../Governance/Claimable.sol";
import "../libraries/CanReclaimTokens.sol";
import "./ERC20WithRate.sol";
import "./ERC20WithPermit.sol";

/// @notice RenERC20 represents a digital asset that has been bridged on to
/// the Ethereum ledger. It exposes mint and burn functions that can only be
/// called by it's associated Gateway contract.
contract RenERC20 is
    Initializable,
    ERC20,
    ERC20Detailed,
    ERC20WithRate,
    ERC20WithPermit,
    Claimable,
    CanReclaimTokens
{
    /* solium-disable-next-line no-empty-blocks */
    function initialize(
        uint256 _chainId,
        address _nextOwner,
        uint256 _initialRate,
        string memory _version,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public initializer {
        ERC20Detailed.initialize(_name, _symbol, _decimals);
        ERC20WithRate.initialize(_nextOwner, _initialRate);
        ERC20WithPermit.initialize(
            _chainId,
            _version,
            _name,
            _symbol,
            _decimals
        );
        Claimable.initialize(_nextOwner);
        CanReclaimTokens.initialize(_nextOwner);
    }

    function burn(address _from, uint256 _amount) public onlyOwner {
        _burn(_from, _amount);
    }

    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }

    function transfer(address recipient, uint256 amount) public returns (bool) {
        require(
            recipient != address(this),
            "RenERC20: can't transfer to token address"
        );
        return super.transfer(recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount)
        public
        returns (bool)
    {
        require(
            recipient != address(this),
            "RenERC20: can't transfer to token address"
        );
        return super.transferFrom(sender, recipient, amount);
    }
}

/* solium-disable-next-line no-empty-blocks */
contract RenERC20Proxy is InitializableAdminUpgradeabilityProxy {}

/// @dev The following are not necessary for deploying renBTC or renZEC contracts,
/// but are used to track deployments.

/* solium-disable-next-line no-empty-blocks */
contract renBTC is RenERC20Proxy {}

/* solium-disable-next-line no-empty-blocks */
contract renZEC is RenERC20Proxy {}

/* solium-disable-next-line no-empty-blocks */
contract renBCH is RenERC20Proxy {}
