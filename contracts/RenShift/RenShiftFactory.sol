pragma solidity 0.5.6;

import "./RenShift.sol";

contract RenShiftFactory {
    address public owner;

    constructor(address _owner) public {
        owner = _owner;
    }

    function create(string memory _name, string memory _symbol, uint8 _decimals) public {
        new RenShift(owner, _name, _symbol, _decimals);
    } 
}