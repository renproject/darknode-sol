pragma solidity ^0.4.23;

import "./libraries/LibRewardVault.sol";

contract RewardVault {
    // Constant address for ethereum
    address constant public ETHEREUM = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    // Reward Vault object
    LibRewardVault.RewardVault private vault;

    // ERC20 token object
    ERC20 private token;

    /** 
    * @notice The RewardVault constructor.
    *
    * @param _rewardeeCount Number of rewardees in each reward round.
    * @param _challengeCount Number of challenges in each reward round.
    * @param _threshold The threshold value for each reward round.
    * @param _dnrAddress The address of the DarknodeRegistry contract.
    * @param _tokenAddress The address of the ERC20 contract, 
    *       `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for ether.
    */
    constructor(uint256 _rewardeeCount, uint256 _challengeCount, uint256 _threshold, address _dnrAddress, address _tokenAddress) public {    
        vault = LibRewardVault.RewardVault({
            currentNonce: 0,
            rewardeeCount : _rewardeeCount,
            challengeCount : _challengeCount,
            threshold : _threshold,
            rewardPerProof : _threshold/(_rewardeeCount * _challengeCount),
            dnrAddress : _dnrAddress,
            tokenAddress : _tokenAddress
        });

        if (_tokenAddress != ETHEREUM) {
            token = ERC20(_tokenAddress);
        }
    }

    /** 
    * @notice The traders deposit fees into the reward vault.
    *
    * @param _challenge challenge for the trader's order.
    * @param _value the amount of fees.
    */
    function deposit(bytes _challenge, uint256 _value) public payable {
        if (vault.tokenAddress == ETHEREUM) {
            require(msg.value == _value);
        } else {
            require(token.allowance(msg.sender, address(this)) == _value);
            require(token.transferFrom(msg.sender, address(this), _value));
        }
        LibRewardVault.deposit(vault, _challenge, _value);
    }

    /** 
    * @notice The darknodes withdraw rewards from the reward vault.
    *
    * @param _challengeID the id of the challenge.
    * @param _proof the proof, proving the computation done.
    * @param _rewardRoundNonce the nonce of the reward round
    */
    function withdraw(bytes32 _challengeID, bytes _proof, uint256 _rewardRoundNonce) public {
        require(LibRewardVault.withdraw(vault, _challengeID, _proof, _rewardRoundNonce, msg.sender));
        if (vault.tokenAddress == ETHEREUM) {
            msg.sender.transfer(vault.rewardPerProof);
        } else {
            require(token.transfer(msg.sender, vault.rewardPerProof));
        }
    }

    /** 
    * @notice Once a threshold is reached for a particular reward round, 
    *       a random sample of orderIDs, and a random sample of darknodes 
    *       are chosen.
    *
    * @param _nonce the nonce of the reward round
    */
    function finalize(uint256 _nonce) public {
        LibRewardVault.finalize(vault, _nonce);
    }

    /** 
    * @notice Checks whether a reward round is finalizable.
    *
    * @param _nonce the nonce of the reward round
    * 
    */
    function isFinalizable(uint256 _nonce) public view returns (bool) {
        return (vault.rewardRounds[_nonce].balance == vault.threshold && !vault.rewardRounds[_nonce].finalized);
    }

    /** 
    * @notice Returns the list of rewardees in the given reward round.
    *
    * @param _nonce the nonce of the reward round
    * 
    */
    function rewardees(uint256 _nonce) public view returns (address[]) {
        require(vault.rewardRounds[_nonce].finalized);
        return vault.rewardRounds[_nonce].rewardees;
    }

    /** 
    * @notice Returns the list of challenges in the given reward round.
    *
    * @param _nonce the nonce of the reward round
    *
    */
    function challengeIds(uint256 _nonce) public view returns (bytes32[]) {
        require(vault.rewardRounds[_nonce].finalized);
        return vault.rewardRounds[_nonce].challenges;
    }
 
}