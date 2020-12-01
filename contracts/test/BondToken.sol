//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract BondToken is ERC20 {
    using SafeMath for uint256;

    uint256 constant INITIAL_SUPPLY = 1000000000;

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _mint(msg.sender, INITIAL_SUPPLY.mul(10 ** decimals()));
    }
}
