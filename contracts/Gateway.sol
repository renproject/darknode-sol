pragma solidity ^0.4.19;

import "./Ownable.sol";

contract Gateway is Ownable {

  address public republicToken;
  address public darkNodeRegistrar;
  address public traderRegistrar;
  uint256 public minimumDarkPoolSize;

  event update(bytes4 functionID, uint256 oldValue, uint256 newValue);

  function Gateway
  (   address _republicToken, 
      address _darkNodeRegistrar, 
      address _traderRegistrar,
      uint256 _minimumDarkPoolSize
  ) public {
    republicToken = _republicToken;
    darkNodeRegistrar = _darkNodeRegistrar;
    traderRegistrar = _traderRegistrar;
    minimumDarkPoolSize = _minimumDarkPoolSize;
  }
 
  function updateDarkNodeRegistrar(address _darkNodeRegistrar) public onlyOwner {
    update(bytes4(sha256("updateDarkNodeRegistrar(address)")), uint256(darkNodeRegistrar), uint256(_darkNodeRegistrar));
    darkNodeRegistrar = _darkNodeRegistrar;
  }

  function updateTraderRegistrar(address _traderRegistrar) public onlyOwner {
    update(bytes4(sha256("updateTraderRegistrar(address)")), uint256(traderRegistrar), uint256(_traderRegistrar));
    traderRegistrar = _traderRegistrar;
  }

  function updateMinimumDarkPoolSize(uint256 _minimumDarkPoolSize) public onlyOwner {
    update(bytes4(sha256("updateMinimumDarkPoolSize(uint256)")), minimumDarkPoolSize, _minimumDarkPoolSize);
    minimumDarkPoolSize = _minimumDarkPoolSize;
  }
 
}