pragma solidity ^0.4.23;

import "./Ownable.sol";

contract RewardGateway is Ownable {
    mapping (address=>address) public rewardVaults;

    function updateRewardVault(address tokenAddress, address rewardVaultAddress) public {
        rewardVaults[tokenAddress] = rewardVaultAddress;
    }
}