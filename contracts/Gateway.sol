pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Gateway is Ownable {

    address public republicToken;
    address public darknodeRegistry;
    address public traderRegistry;
    uint256 public minimumPodSize;

    event update(bytes4 functionID, uint256 oldValue, uint256 newValue);

    constructor(
        address _republicToken,
        address _darknodeRegistry,
        address _traderRegistry,
        uint256 _minimumPodSize
    ) public {
        republicToken = _republicToken;
        darknodeRegistry = _darknodeRegistry;
        traderRegistry = _traderRegistry;
        minimumPodSize = _minimumPodSize;
    }

    function updateDarknodeRegistry(address _darknodeRegistry) public onlyOwner {
        emit update(bytes4(sha256("updateDarknodeRegistry(address)")), uint256(darknodeRegistry), uint256(_darknodeRegistry));
        darknodeRegistry = _darknodeRegistry;
    }

    function updateTraderRegistry(address _traderRegistry) public onlyOwner {
        emit update(bytes4(sha256("updateTraderRegistry(address)")), uint256(traderRegistry), uint256(_traderRegistry));
        traderRegistry = _traderRegistry;
    }

    function updateMinimumPodSize(uint256 _minimumPodSize) public onlyOwner {
        emit update(bytes4(sha256("updateMinimumPodSize(uint256)")), minimumPodSize, _minimumPodSize);
        minimumPodSize = _minimumPodSize;
    }

}