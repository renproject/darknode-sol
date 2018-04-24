pragma solidity ^0.4.23;

contract RewardGateway {
    mapping (address=>address) public rewardVaults;

    function updateRewardVault(address _tokenAddress, address _rewardVaultAddress) public {
        rewardVaults[_tokenAddress] = _rewardVaultAddress;
    }
}