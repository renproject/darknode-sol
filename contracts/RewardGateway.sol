pragma solidity ^0.4.23;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract RewardGateway is Ownable {
    mapping (address=>address) public rewardVaults;

    function updateRewardVault(address _tokenAddress, address _rewardVaultAddress) onlyOwner public {
        rewardVaults[_tokenAddress] = _rewardVaultAddress;
    }
}