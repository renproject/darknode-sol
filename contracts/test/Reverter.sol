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
        require(ren.transferFrom(msg.sender, this, _bond), "bond transfer failed");
        ren.approve(dnr, _bond);
        dnr.register(_darknodeID, _publicKey);
    }

    function () public payable {
        revert("malicious revert");
    }
}