pragma solidity ^0.4.24;

interface DarknodeSlasher {
    function submitChallengeOrder(
        bytes details,
        uint64 settlementID,
        uint64 tokens,
        uint256 price,
        uint256 volume,
        uint256 minimumVolume
    ) external;

    function submitChallenge(bytes32 _buyID, bytes32 _sellID) external;

}
