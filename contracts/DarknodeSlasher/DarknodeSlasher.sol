pragma solidity ^0.5.8;

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

    function slash(address _guilty, address _challenger, uint256 _percentage)
        external
        onlyOwner
    {
        darknodeRegistry.slash(_guilty, _challenger, _percentage);
    }

    function blacklist(address _guilty) external onlyOwner {
        darknodeRegistry.slash(_guilty, owner(), 0);
    }
}
