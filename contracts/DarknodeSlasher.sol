pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./DarknodeRegistry.sol";

contract DarknodeSlasher is Ownable {

    DarknodeRegistry public trustedDarknodeRegistry;

    modifier onlyDarknode(bytes20 _id) {
        require(trustedDarknodeRegistry.isRegistered(_id) || trustedDarknodeRegistry.isDeregistered(_id));
        _;
    }

    constructor(DarknodeRegistry darknodeRegistry) public {
        trustedDarknodeRegistry = darknodeRegistry;
    }

    function submitChallengeOrder() external {
        // FIXME: Accept the details of a confirmed order. Double check that
        // this order has not been challenged yet.
    }

    function submitChallenge() external {
        // FIXME: Verify whether or not an order, and its confirmed match, are
        // actually matching. If not, slash the bond of the confirmer and
        // reward the two msg.senders of the "submitChallengeOrder" calls.
    }

    function slash(bytes20 _prover, bytes20 _challenger1, bytes20 _challenger2) internal {
        trustedDarknodeRegistry.slash(_prover, _challenger1, _challenger2);
    }

}