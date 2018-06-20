pragma solidity ^0.4.24;

import "../DarknodeRegistry.sol";
import "../RepublicToken.sol";

contract Reverter {

    function register(DarknodeRegistry dnr, RepublicToken ren, bytes20 _darknodeID, bytes _publicKey, uint256 _bond) public {
        // REN allowance
        require(ren.allowance(msg.sender, address(this)) >= _bond);
        require(ren.transferFrom(msg.sender, address(this), _bond));
        ren.approve(dnr, _bond);
        dnr.register(_darknodeID, _publicKey, _bond);
    }

    function () public payable {
        revert();
    }
}