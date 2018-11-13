pragma solidity ^0.4.24;

interface DarknodeRegistry {
    function register(address _darknodeID, bytes _publicKey) external;

    function deregister(address _darknodeID) external;

    function epoch() external;

    function updateMinimumBond(uint256 _nextMinimumBond) external;

    function updateMinimumPodSize(uint256 _nextMinimumPodSize) external;

    function updateMinimumEpochInterval(uint256 _nextMinimumEpochInterval) external;

    function updateSlasher(address _slasher) external;

    function slash(address _prover, address _challenger1, address _challenger2) external;

    function refund(address _darknodeID) external;

    function getDarknodeOwner(address _darknodeID) external view returns (address);

    function getDarknodeBond(address _darknodeID) external view returns (uint256);

    function getDarknodePublicKey(address _darknodeID) external view returns (bytes);

    function getDarknodes(address _start, uint256 _count) external view returns (address[]);

    function getPreviousDarknodes(address _start, uint256 _count) external view returns (address[]);

    function isPendingRegistration(address _darknodeID) external view returns (bool);

    function isPendingDeregistration(address _darknodeID) external view returns (bool);

    function isDeregistered(address _darknodeID) public view returns (bool);

    function isDeregisterable(address _darknodeID) public view returns (bool);

    function isRefunded(address _darknodeID) public view returns (bool);

    function isRefundable(address _darknodeID) public view returns (bool);

    function isRegistered(address _darknodeID) public view returns (bool);

    function isRegisteredInPreviousEpoch(address _darknodeID) public view returns (bool);

}
