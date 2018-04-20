pragma solidity ^0.4.23;

import "./DarkNodeRegistry.sol";

contract RewardVaultEther {

	uint256 public currentNonce;
	uint256 public rewardeeCount;
	uint256 public challengeCount;
	uint256 public rewardPerProof;
	uint256 public threshold;
	DarkNodeRegistry dnr;

	struct RewardRound {
		bool finalized;
		uint256 rrn;
		uint256 balance;
		bytes[] orders;
		bytes[] challenges;
		address[] rewardees;
		mapping(address => mapping (bytes=>bool)) rewards;
	}

	mapping (bytes32 => bool) selectedOrder;
	mapping (bytes32 => bool) selectedNode;
	mapping (uint256 => RewardRound) public RewardRounds;

	function RewardVaultEther(uint256 _rewardeeCount, uint256 _challengeCount, uint256 _threshold, address _dnrAddress) public {	
		rewardeeCount = _rewardeeCount;
		challengeCount = _challengeCount;
		threshold = _threshold;
		rewardPerProof = _threshold/(_rewardeeCount * _challengeCount);
		dnr = DarkNodeRegistry(_dnrAddress);
	}

	function Deposit(bytes _order) public payable {
		RewardRounds[currentNonce].orders.push(_order);

		if (RewardRounds[currentNonce].balance + msg.value >= threshold) {
			currentNonce++;
			RewardRounds[currentNonce].balance = RewardRounds[currentNonce - 1].balance + msg.value - threshold;
			RewardRounds[currentNonce - 1].balance = threshold;
			RewardRounds[currentNonce - 1].rrn = uint256(block.blockhash(block.number - 1));
			return;
		} 

		RewardRounds[currentNonce].balance += msg.value;
		return;
	}

	function Finalize(uint256 nonce) public {
		require(RewardRounds[nonce].balance == threshold && !RewardRounds[nonce].finalized);
		finalizeRewardRound(nonce);
		RewardRounds[nonce].finalized = true;
	}

	function Withdraw(bytes challenge, bytes proof, uint256 rewardRoundNonce) public {
		require(validateProof(challenge, proof));
		RewardRounds[rewardRoundNonce].balance -= rewardPerProof;
		RewardRounds[rewardRoundNonce].rewards[msg.sender][challenge] = false;
		msg.sender.transfer(rewardPerProof);
	}

	function finalizeRewardRound(uint256 n) internal {
		uint256 x = RewardRounds[n].rrn % (RewardRounds[n].orders.length);

		for (uint256 i = 0; i < challengeCount; i++) {
			while (selectedOrder[keccak256(n, x)]) {
				x = x+1;
			}
			RewardRounds[n].challenges.push(RewardRounds[n].orders[x]);
			selectedOrder[keccak256(n, x)] = true;
			x = (x + RewardRounds[n].rrn) % RewardRounds[n].orders.length;
		}

		bytes20[] memory nodes = dnr.getDarkNodes();
		x = RewardRounds[n].rrn % nodes.length;

		address rewardee;
		for (i = 0; i < rewardeeCount; i++) {
			while (selectedNode[keccak256(n, x)]) {
				x = x+1;
			}
			rewardee = dnr.getOwner(nodes[x]);
			RewardRounds[n].rewardees.push(rewardee);
			for (uint256 j = 0; j < challengeCount; j++) {
				RewardRounds[n].rewards[rewardee][RewardRounds[n].challenges[j]] = true;
			}
			selectedNode[keccak256(n, x)] = true;
			x = (x + RewardRounds[n].rrn) % nodes.length;
		}
	}

	function getRewardees(uint256 nonce) public view returns (address[]) {
		return RewardRounds[nonce].rewardees;
	}

	function validateProof(bytes _challenge, bytes _proof) internal pure returns (bool) {
		// TODO: Add actual logic in the next version of the contract.
		return true;
	}
}


