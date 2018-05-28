pragma solidity ^0.4.24;

import "../DarknodeRegistry.sol";

library LibRewardVault {

    address constant public ETHEREUM = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    struct RewardRound {
        bool finalized;
        uint256 rrn;
        uint256 balance;
        bytes[] orders;
        bytes32[] challenges;
        address[] rewardees;

        mapping(address => mapping (bytes32=>bool)) rewards;
    }

    struct RewardVault {
        uint256 currentNonce;
        uint256 rewardeeCount;
        uint256 challengeCount;
        uint256 rewardPerProof;
        uint256 threshold;
        address dnrAddress;
        address tokenAddress;

        mapping (uint256 => mapping (uint256 => bool)) selectedOrder;
        mapping (bytes32 => bool) selectedNode;
        mapping (uint256 => RewardRound) rewardRounds;
    }

    function deposit(RewardVault storage self, bytes _order, uint256 _value) internal {
        self.rewardRounds[self.currentNonce].orders.push(_order);
        if (self.rewardRounds[self.currentNonce].balance + _value >= self.threshold) {
            self.rewardRounds[self.currentNonce + 1].balance = self.rewardRounds[self.currentNonce].balance + _value - self.threshold;
            self.rewardRounds[self.currentNonce].balance = self.threshold;
            self.rewardRounds[self.currentNonce].rrn = uint256(blockhash(block.number - 1));
            
            self.currentNonce++;
            return;
        }
        self.rewardRounds[self.currentNonce].balance += _value;
        return;
    }

    function withdraw(RewardVault storage self, bytes32 challenge, bytes proof, uint256 rewardRoundNonce, address _sender)
        internal returns(bool)
    {
        require(self.rewardRounds[rewardRoundNonce].finalized);
        if (!self.rewardRounds[rewardRoundNonce].rewards[_sender][challenge]) {
            return false;
        }
        if (!validateProof(challenge, proof)) {
            return false;
        }
        self.rewardRounds[rewardRoundNonce].balance -= self.rewardPerProof;
        self.rewardRounds[rewardRoundNonce].rewards[_sender][challenge] = false;
        return true;
    }

    function finalize(RewardVault storage self, uint256 n) internal {

        DarknodeRegistry dnr = DarknodeRegistry(self.dnrAddress);
        require(self.rewardRounds[n].balance == self.threshold && !self.rewardRounds[n].finalized);
        uint256 x = self.rewardRounds[n].rrn % (self.rewardRounds[n].orders.length);

        // Choose `challengeCount` orders using rrn as random seed
        for (uint256 i = 0; i < self.challengeCount; i++) {
            while (self.selectedOrder[n][x]) {
                x = x+1;
            }
            self.rewardRounds[n].challenges.push(keccak256(self.rewardRounds[n].orders[x]));
            self.selectedOrder[n][x] = true;
            x = (x + self.rewardRounds[n].rrn) % self.rewardRounds[n].orders.length;
        }

        bytes20[] memory nodeIds = dnr.getDarknodes();
        x = self.rewardRounds[n].rrn % nodeIds.length;

        // Choose `rewardeeCount` nodes using rrn as random seed
        for (i = 0; i < self.rewardeeCount; i++) {
            while (self.selectedNode[keccak256(abi.encodePacked(n, x))]) {
                x = x+1;
            }
            address rewardee = dnr.getOwner(nodeIds[x]);
            self.rewardRounds[n].rewardees.push(rewardee);
            for (uint256 j = 0; j < self.challengeCount; j++) {
                self.rewardRounds[n].rewards[rewardee][self.rewardRounds[n].challenges[j]] = true;
            }
            self.selectedNode[keccak256(abi.encodePacked(n, x))] = true;
            x = (x + self.rewardRounds[n].rrn) % nodeIds.length;
        }
        self.rewardRounds[n].finalized = true;
    }

    function validateProof(bytes32 _challenge, bytes _proof) internal pure returns (bool) {
        // TODO: Add actual logic in the next version of the contract.
        return true;
    }

}