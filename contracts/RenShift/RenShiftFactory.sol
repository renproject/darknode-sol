pragma solidity 0.5.6;

import "./RenShift.sol";

contract RenShiftFactory {
    address public owner;

    address payable rewardVault;

    constructor(address _owner, address payable _rewardVault) public {
        owner = _owner;
        rewardVault = _rewardVault;
    }

    function create(string memory _name, string memory _symbol, uint8 _decimals) public {
        new RenShift(owner, _name, _symbol, _decimals, 0, rewardVault);
    } 

}