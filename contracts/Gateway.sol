pragma solidity ^0.4.20;

import "./Ownable.sol";

contract RepublicProtocol is Ownable {

  address public token;
  address public darkNodeRegistry;
  address public traderRegistry;
  uint256 public darkpoolSize;

  event Update();

  function RepublicProtocol (address _token, address _darkNodeRegistry, address _traderRegistry) public {
    token = _token;
    darkNodeRegistry = _darkNodeRegistry;
    traderRegistry = _traderRegistry;
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