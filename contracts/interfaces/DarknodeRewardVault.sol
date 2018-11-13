pragma solidity ^0.4.24;

import "../DarknodeRegistry.sol";

interface DarknodeRewardVault {
    function updateDarknodeRegistry(DarknodeRegistry _newDarknodeRegistry) public;

    function deposit(address _darknode, ERC20 _token, uint256 _value) public payable;

    function withdraw(address _darknode, ERC20 _token) public;

}
