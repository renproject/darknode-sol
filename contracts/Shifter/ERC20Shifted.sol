pragma solidity ^0.5.8;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

import "../libraries/Claimable.sol";

contract ERC20Shifted is ERC20, ERC20Detailed, Claimable {
    constructor(string memory _name, string memory _symbol, uint8 _decimals) public ERC20Detailed(_name, _symbol, _decimals) {
    }

    function burn(address _from, uint256 _amount) public onlyOwner {
        _burn(_from, _amount);
    }

    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
}

/* solium-disable-next-line no-empty-blocks */
contract zBTC is ERC20Shifted("Shifted BTC", "zBTC", 8) {}

/* solium-disable-next-line no-empty-blocks */
contract zZEC is ERC20Shifted("Shifted ZEC", "zZEC", 8) {}
