pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./CompatibleERC20.sol";
import "./DarknodeRegistry.sol";
import "./DarknodeJudge.sol";

/// @notice DarknodePayment is responsible for paying off darknodes for their computation.
contract DarknodePayment is Ownable {
    using SafeMath for uint256;
    using CompatibleERC20Functions for CompatibleERC20;

    string public VERSION; // Passed in as a constructor parameter.

    address public daiContractAddress; // Passed in as a constructor parameter.

    DarknodeRegistry public darknodeRegistry; // Passed in as a constructor parameter.

    DarknodeJudge public darknodeJudge; // Passed in as a constructor parameter.

    // Mapping from cycle -> address -> hasClaimedRewards
    mapping(uint256 => mapping(address => bool)) public rewardClaimed;

    // Mapping from darknodeAddress -> accountBalance
    mapping(address => uint256) public darknodeBalances;

    // The current cycle epoch hash
    uint256 public currentCycle;

    // Timestamps of current and next cycle
    uint256 public currentCycleStartTime;
    uint256 public nextCycleStartTime;

    // The previous cycle epoch hash
    uint256 public previousCycle;

    // The length of a cycle in seconds
    uint256 public cycleDuration;

    // The rewards from last cycle locked up for darknodes to claim
    uint256 public previousCycleRewardPool;
    // The amount that each darknode was rewarded last cycle
    uint256 public previousCycleRewardShare;

    // The amount that has been claimed by darknodes but not yet withdrawn
    uint256 private rewardsClaimed;

    /// @notice Emitted when a payment was made to the contract
    /// @param _payer The address of who made the payment
    /// @param _value The amount of DAI paid to the contract
    event LogPaymentReceived(address _payer, uint256 _value);

    /// @notice Emitted when a darknode calls withdraw
    /// @param _payee The address of the darknode which withdrew
    /// @param _value The amount of DAI withdrawn
    event LogDarknodeWithdrew(address _payee, uint256 _value);

    /// @notice Emitted when a new cycle happens
    /// @param _newCycle The new, current cycle
    /// @param _lastCycle The previous cycle
    /// @param _lastCycleRewardPool The total reward pool last cycle
    /// @param _lastCycleRewardShare The total share allocated to each darknode for the last cycle
    event LogNewCycle(uint256 _newCycle, uint256 _lastCycle, uint256 _lastCycleRewardPool, uint256 _lastCycleRewardShare);

    /// @notice Only allow registered dark nodes.
    modifier onlyDarknode() {
        require(darknodeRegistry.isRegistered(msg.sender), "not a registered darknode");
        _;
    }

    /// @notice Only allow darknodes which haven't been Judgeed
    modifier notBlacklisted() {
        require(!darknodeJudge.isBlacklisted(msg.sender), "darknode is blacklisted");
        _;
    }

    /// @notice The contract constructor.
    /// Starts the current cycle using the time of deploy and the current
    /// epoch according to the darknode registry
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _daiAddress The address of the DAI token contract.
    /// @param _darknodeRegistry The address of the Darknode Registry contract
    /// @param _cycleDuration The time between each cycle in days
    constructor(
        string _VERSION,
        address _daiAddress,
        DarknodeRegistry _darknodeRegistry,
        DarknodeJudge _darknodeJudge,
        uint256 _cycleDuration
    ) public {
        VERSION = _VERSION;
        daiContractAddress = _daiAddress;
        darknodeRegistry = _darknodeRegistry;
        darknodeJudge = _darknodeJudge;
        cycleDuration = _cycleDuration * 1 days;

        // Start the current cycle
        (uint256 dnrCurrentEpoch, ) = darknodeRegistry.currentEpoch();
        currentCycle = dnrCurrentEpoch;
        currentCycleStartTime = now;
        nextCycleStartTime = currentCycleStartTime + cycleDuration;
    }

    /// @notice Deposits DAI into the contract to be paid to the Darknodes
    ///
    /// @param _value The amount of DAI deposit in the token's smallest unit.
    function deposit(uint256 _value) external payable {
        require(msg.value == 0, "unexpected ether transfer");
        uint256 receivedValue = CompatibleERC20(daiContractAddress).safeTransferFromWithFees(msg.sender, this, _value);
        emit LogPaymentReceived(msg.sender, receivedValue);
    }

    /// @notice The current balance of the contract available as reward for the current cycle
    function currentCycleRewardPool() external view returns (uint256) {
        uint256 currentBalance = CompatibleERC20(daiContractAddress).balanceOf(address(this));
        // Lock up the reward for darknodes to claim
        return currentBalance - previousCycleRewardPool - rewardsClaimed;
    }

    /// @notice Transfers to the calling darknode the amount of DAI allocated to it as reward.
    function withdraw() external onlyDarknode {
        uint256 amount = darknodeBalances[msg.sender];
        require(amount > 0, "nothing to withdraw");

        darknodeBalances[msg.sender] = 0;
        rewardsClaimed -= amount;
        CompatibleERC20(daiContractAddress).safeTransfer(msg.sender, amount);
        emit LogDarknodeWithdrew(msg.sender, amount);
    }

    /// @notice Claims the rewards allocated to the darknode last cycle and increments
    /// the darknode balances. Whitelists the darknode if it hasn't already been
    /// whitelisted. If a darknode does not call claim() then the rewards for the previous cycle is lost.
    function claim() external onlyDarknode notBlacklisted {
        address darknode = msg.sender;
        uint256 fetchedCurrentCycle = fetchAndUpdateCurrentCycle();

        if (darknodeJudge.darknodeWhitelist(darknode) == fetchedCurrentCycle) {
            // Can't claim rewards until next cycle
            return;            
        }

        // The darknode hasn't been whitelisted before
        if (darknodeJudge.darknodeWhitelist(darknode) == 0) {
            darknodeJudge.whitelist(darknode, fetchedCurrentCycle);
            return;
        }

        // Claim share of rewards allocated for last cycle
        if (previousCycle != 0) {
            privateClaimDarknodeReward(darknode);
        }
    }

    /// @notice Returns the current cycle according to if sufficient time has passed.
    /// If the cycle has changed, it will update the previousCycleRewardPool and previousCycleRewardShare.
    /// This function is called by claim(). To avoid darknodes from having to pay the cost for the
    /// change in cycle, this function should ideally be called as a part of DarknodeRegistry.epoch().
    function fetchAndUpdateCurrentCycle() public returns (uint256) {
        // If the cycle has changed
        if (now >= nextCycleStartTime) {
            privateUpdateCycle();
        }
        return currentCycle;
    }


    /// @notice Blacklists a darknode from participating in future rewards.
    /// Remaining rewards are allocated to the darknode before the black list occurs.
    /// Only the owner of the DarknodePayment contract can call this function.
    ///
    /// @param _addr The address of the darknode to blacklist
    function blacklist(address _addr) external onlyOwner {
        // Allocate their remaining rewards before blacklisting them
        if (!rewardClaimed[previousCycle][_addr]) {
            privateClaimDarknodeReward(_addr);
        }
        darknodeJudge.blacklist(_addr);
    }

    /// @notice Changes the current cycle
    function privateUpdateCycle() private {
        (uint256 dnrCurrentEpoch, ) = darknodeRegistry.currentEpoch();
        require(dnrCurrentEpoch != currentCycle, "cycle should have changed");

        if (darknodeJudge.whitelistTotal() == 0) {
            previousCycleRewardPool = 0;
            previousCycleRewardShare = 0;
        } else {
            // Lock up the current balance for darknode reward allocation
            uint256 currentBalance = CompatibleERC20(daiContractAddress).balanceOf(address(this));
            previousCycleRewardPool = currentBalance - rewardsClaimed;
            previousCycleRewardShare = previousCycleRewardPool / darknodeJudge.whitelistTotal();
        }

        // Update the cycle
        previousCycle = currentCycle;
        currentCycle = dnrCurrentEpoch;
        currentCycleStartTime = nextCycleStartTime;
        nextCycleStartTime += cycleDuration;

        // Update pending whitelist/blacklist numbers
        darknodeJudge.update();

        emit LogNewCycle(currentCycle, previousCycle, previousCycleRewardPool, previousCycleRewardShare);
    }

    function privateClaimDarknodeReward(address _addr) private {
        require(!rewardClaimed[previousCycle][_addr], "reward already claimed");
        rewardClaimed[previousCycle][_addr] = true;

        darknodeBalances[_addr] += previousCycleRewardShare;
        rewardsClaimed += previousCycleRewardShare;
        previousCycleRewardPool -= previousCycleRewardShare;
    }

}
