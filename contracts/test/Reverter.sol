pragma solidity ^0.4.24;

import "../DarknodeRegistry.sol";
import "../RepublicToken.sol";

/// @notice A contract that reverts when any funds are transferred to it.
/// Additionally, it has a function to register itself as a darknode to the
/// provided Darknode Registry.
/// Used to help in the testing of contracts.
contract Reverter {

    function register(DarknodeRegistry dnr, RepublicToken ren, address _darknodeID, bytes _publicKey, uint256 _bond) public {
        // REN allowance
        ren.transferFrom(msg.sender, address(this), _bond);
        ren.approve(dnr, _bond);
        dnr.register(_darknodeID, _publicKey, _bond);
    }

    function () public payable {
        revert("malicious revert");
    }
}