pragma solidity 0.5.17;

import "../DarknodeRegistry/DarknodeRegistry.sol";

/// @notice DarknodeRegistryForwarder implements the DNR's methods that are used
/// by the DNP, and it forwards them all to the DNR except
/// `isRegisteredInPreviousEpoch`, for which it returns false in order to make
/// calls to `claim` revert.
contract DarknodeRegistryForwarder {
    DarknodeRegistryLogicV1 dnr;

    constructor(DarknodeRegistryLogicV1 _dnr) public {
        dnr = _dnr;
    }

    /// @notice Returns if a darknode is in the registered state.
    function isRegistered(address _darknodeID) public view returns (bool) {
        return dnr.isRegistered(_darknodeID);
    }

    function currentEpoch() public view returns (uint256, uint256) {
        return dnr.currentEpoch();
    }

    function getDarknodeOperator(address _darknodeID)
        public
        view
        returns (address payable)
    {
        return dnr.getDarknodeOperator(_darknodeID);
    }

    function isRegisteredInPreviousEpoch(address _darknodeID)
        public
        view
        returns (bool)
    {
        // return dnr.isRegisteredInPreviousEpoch(_darknodeID);
        return false;
    }

    function numDarknodesPreviousEpoch() public view returns (uint256) {
        return dnr.numDarknodesPreviousEpoch();
    }
}
