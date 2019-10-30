pragma solidity ^0.5.12;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "../DarknodeRegistry/DarknodeRegistry.sol";

/// @notice DarknodeSlasher will become a voting system for darknodes to
/// deregister other misbehaving darknodes.
/// Right now, it is a placeholder.
contract DarknodeSlasher is Ownable {

    DarknodeRegistry public darknodeRegistry;

    constructor(DarknodeRegistry _darknodeRegistry) public {
        darknodeRegistry = _darknodeRegistry;
    }

    function slash(address _prover, address _challenger1, address _challenger2)
        external
        onlyOwner
    {
        darknodeRegistry.slash(_prover, _challenger1, _challenger2);
    }
}
