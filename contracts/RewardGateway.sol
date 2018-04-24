pragma solidity ^0.4.23;

contract RewardGateway {
    mapping (address=>address) public rewardVaults;

    function updateRewardVault(address tokenAddress, address rewardVaultAddress) public {
        rewardVaults[tokenAddress] = rewardVaultAddress;
    }
}