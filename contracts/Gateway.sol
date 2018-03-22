pragma solidity ^0.4.20;

import "./Ownable.sol";

contract Gateway is Ownable {

  address public token;
  address public darkNodeRegistry;
  address public traderRegistry;
  uint256 public darkpoolSize;

  event Update();

  function Gateway
  (   address _token, 
      address _darkNodeRegistry, 
      address _traderRegistry,
      uint256 _darkpoolSize
  ) public {
    token = _token;
    darkNodeRegistry = _darkNodeRegistry;
    traderRegistry = _traderRegistry;
    darkpoolSize = _darkpoolSize;
  }
 
  function updateDarkNodeRegistry(address _darkNodeRegistry) public onlyOwner {
    darkNodeRegistry = _darkNodeRegistry;
    Update();
  }

  function updateTraderRegistry(address _traderRegistry) public onlyOwner {
    traderRegistry = _traderRegistry;
    Update();
  }

  function updateMinimumDarkpoolSize(uint256 _darkpoolSize) public onlyOwner {
    darkpoolSize = _darkpoolSize;
    Update();
  }
 
}