pragma solidity 0.5.17;

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
contract RenERC20LogicV1 is
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

    /// @notice mint can only be called by the tokens' associated Gateway
    /// contract. See Gateway's mint function instead.
    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }

    /// @notice burn can only be called by the tokens' associated Gateway
    /// contract. See Gateway's burn functions instead.
    function burn(address _from, uint256 _amount) public onlyOwner {
        _burn(_from, _amount);
    }

    function transfer(address recipient, uint256 amount) public returns (bool) {
        // Disallow sending tokens to the ERC20 contract address - a common
        // mistake caused by the Ethereum transaction's `to` needing to be
        // the token's address.
        require(
            recipient != address(this),
            "RenERC20: can't transfer to token address"
        );
        return super.transfer(recipient, amount);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public returns (bool) {
        // Disallow sending tokens to the ERC20 contract address (see comment
        // in `transfer`).
        require(
            recipient != address(this),
            "RenERC20: can't transfer to token address"
        );
        return super.transferFrom(sender, recipient, amount);
    }
}

/* solium-disable-next-line no-empty-blocks */
// contract RenERC20Proxy is InitializableAdminUpgradeabilityProxy {}

/// @dev The following are not necessary for deploying renBTC or renZEC contracts,
/// but are used to track deployments.

/* solium-disable-next-line no-empty-blocks */
contract RenBTC is InitializableAdminUpgradeabilityProxy {

}

/* solium-disable-next-line no-empty-blocks */
contract RenZEC is InitializableAdminUpgradeabilityProxy {

}

/* solium-disable-next-line no-empty-blocks */
contract RenBCH is InitializableAdminUpgradeabilityProxy {

}
