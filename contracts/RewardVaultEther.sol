pragma solidity ^0.4.23;

contract DarkNodeRegistry {
	function getDarkNodes() public view returns (bytes20[]);
	function getOwner(bytes20 _nodeId) public view returns (address);
}

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
		mapping(address => mapping (bytes=>bool)) rewards;
	}

	// Helper struct
	struct Selected {
		mapping (uint256=>bool) order;
		mapping (uint256=>bool) node;
	}	

	mapping (uint256 => RewardRound) RewardRounds;

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
		require(RewardRounds[rewardRoundNonce].rewards[msg.sender][challenge]);
		require(validateProof(challenge, proof));
		RewardRounds[rewardRoundNonce].balance -= rewardPerProof;
		RewardRounds[rewardRoundNonce].rewards[msg.sender][challenge] = false;
		msg.sender.transfer(rewardPerProof);
	}

	function finalizeRewardRound(uint256 n) internal {
		uint256 x = RewardRounds[n].rrn % (RewardRounds[n].orders.length);
		bytes[] challenges;

		Selected storage selected;

		for (uint256 i = 0; i < challengeCount; i++) {
			while (selected.order[x]) {
				x = x+1;
			}
			challenges.push(RewardRounds[n].orders[x]);
			selected.order[x] = true;
			x = (x + RewardRounds[n].rrn) % challenges.length;
		}

		bytes20[] memory nodes = dnr.getDarkNodes();
		x = RewardRounds[n].rrn % nodes.length;
		
		for (i = 0; i < rewardeeCount; i++) {
			while (selected.node[x]) {
				x = x+1;
			}
			for (uint256 j = 0; j < challengeCount; j++) {
				RewardRounds[n].rewards[dnr.getOwner(nodes[x])][challenges[j]] = true;
			}
			x = (x + RewardRounds[n].rrn) % nodes.length;
		}
	}

	function validateProof(bytes _challenge, bytes _proof) internal pure returns (bool) {
		// TODO: Add actual logic in the next version of the contract.
		return true;
	}
}


