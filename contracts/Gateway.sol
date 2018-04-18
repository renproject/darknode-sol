pragma solidity ^0.4.21;

import "./Ownable.sol";

contract Gateway is Ownable {

    address public republicToken;
    address public darkNodeRegistry;
    address public traderRegistry;
    uint256 public minimumDarkPoolSize;

    event update(bytes4 functionID, uint256 oldValue, uint256 newValue);

    function Gateway(
        address _republicToken, 
        address _darkNodeRegistry, 
        address _traderRegistry,
        uint256 _minimumDarkPoolSize
    ) public {
        republicToken = _republicToken;
        darkNodeRegistry = _darkNodeRegistry;
        traderRegistry = _traderRegistry;
        minimumDarkPoolSize = _minimumDarkPoolSize;
    }
  
    function updateDarkNodeRegistry(address _darkNodeRegistry) public onlyOwner {
        emit update(bytes4(sha256("updateDarkNodeRegistry(address)")), uint256(darkNodeRegistry), uint256(_darkNodeRegistry));
        darkNodeRegistry = _darkNodeRegistry;
    }

    function updateTraderRegistry(address _traderRegistry) public onlyOwner {
        emit update(bytes4(sha256("updateTraderRegistry(address)")), uint256(traderRegistry), uint256(_traderRegistry));
        traderRegistry = _traderRegistry;
    }

    function updateMinimumDarkPoolSize(uint256 _minimumDarkPoolSize) public onlyOwner {
        emit update(bytes4(sha256("updateMinimumDarkPoolSize(uint256)")), minimumDarkPoolSize, _minimumDarkPoolSize);
        minimumDarkPoolSize = _minimumDarkPoolSize;
    }
 
}