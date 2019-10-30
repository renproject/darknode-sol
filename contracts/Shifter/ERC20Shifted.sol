pragma solidity ^0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

import "../libraries/Claimable.sol";

/// @notice ERC20Shifted represents a digital asset that has been bridged on to
/// the Ethereum ledger. It exposes mint and burn functions that can only be
/// called by it's associated Shifter.
contract ERC20Shifted is ERC20, ERC20Detailed, Claimable {

    /* solium-disable-next-line no-empty-blocks */
    constructor(string memory _name, string memory _symbol, uint8 _decimals) public ERC20Detailed(_name, _symbol, _decimals) {}

    /// @notice Allow the owner of the contract to recover funds accidentally
    /// sent to the contract. To withdraw ETH, the token should be set to `0x0`.
    function recoverTokens(address _token) external onlyOwner {
        if (_token == address(0x0)) {
            msg.sender.transfer(address(this).balance);
        } else {
            ERC20(_token).transfer(msg.sender, ERC20(_token).balanceOf(address(this)));
        }
    }

    function burn(address _from, uint256 _amount) public onlyOwner {
        _burn(_from, _amount);
    }

    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
}

/// @dev The following are not necessary for deploying zBTC or zZEC contracts,
/// but are used to track deployments.

/* solium-disable-next-line no-empty-blocks */
contract zBTC is ERC20Shifted("Shifted BTC", "zBTC", 8) {}

/* solium-disable-next-line no-empty-blocks */
contract zZEC is ERC20Shifted("Shifted ZEC", "zZEC", 8) {}

/* solium-disable-next-line no-empty-blocks */
contract zBCH is ERC20Shifted("Shifted BCH", "zBCH", 8) {}
