pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./CompatibleERC20.sol";
import "./DarknodeRegistry.sol";
import "./DarknodePayroll.sol";

/// @notice DarknodePayment is responsible for paying off darknodes for their computation.
contract DarknodePayment is Ownable {
    using SafeMath for uint256;
    using CompatibleERC20Functions for CompatibleERC20;

    string public VERSION; // Passed in as a constructor parameter.

    address public daiContractAddress; // Passed in as a constructor parameter.

    DarknodeRegistry public darknodeRegistry; // Passed in as a constructor parameter.

    // Tracks which Darknodes are blacklisted and which ones are whitelisted
    DarknodePayroll public darknodePayroll; // Passed in as a constructor parameter.

    // The address which can call blacklist(), whitelist()
    address public darknodeJury;

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

    /// @notice Emitted when a darknode claims their share of reward
    /// @param _darknode The darknode which claimed
    /// @param _share The share that was claimed
    /// @param _balance The balance of that darknode
    event LogDarknodeClaim(address _darknode, uint256 _share, uint256 _balance);

    /// @notice Emitted when a new cycle happens
    /// @param _newCycle The new, current cycle
    /// @param _lastCycle The previous cycle
    /// @param _lastCycleRewardPool The total reward pool last cycle
    /// @param _lastCycleRewardShare The total share allocated to each darknode for the last cycle
    event LogNewCycle(uint256 _newCycle, uint256 _lastCycle, uint256 _lastCycleRewardPool, uint256 _lastCycleRewardShare);

    /// @notice Only allow registered dark nodes.
    modifier onlyDarknode(address _darknode) {
        require(darknodeRegistry.isRegistered(_darknode), "not a registered darknode");
        _;
    }

    /// @notice Only allow darknodes which haven't been blacklisted
    modifier notBlacklisted(address _darknode) {
        require(!darknodePayroll.isBlacklisted(_darknode), "darknode is blacklisted");
        _;
    }

    /// @notice Only allow the Darknode Payment contract.
    modifier onlyJury() {
        require(darknodeJury == msg.sender, "not the jury");
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
        DarknodePayroll _darknodePayroll,
        uint256 _cycleDuration
    ) public {
        VERSION = _VERSION;
        daiContractAddress = _daiAddress;
        darknodeRegistry = _darknodeRegistry;
        darknodePayroll = _darknodePayroll;
        cycleDuration = _cycleDuration * 1 days;
        // Default to the owner
        darknodeJury = msg.sender;

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

    /// @notice Withdraw fees earned by a Darknode. The fees will be sent to
    /// the owner of the Darknode.
    ///
    /// @param _darknode The address of the Darknode whose fees are being
    ///        withdrawn. The owner of this Darknode will receive the fees.

    function withdraw(address _darknode) external {
        address darknodeOwner = darknodeRegistry.getDarknodeOwner(_darknode);
        require(darknodeOwner != 0x0, "invalid darknode owner");

        uint256 amount = darknodeBalances[_darknode];
        require(amount > 0, "nothing to withdraw");

        darknodeBalances[_darknode] = 0;
        rewardsClaimed -= amount;

        CompatibleERC20(daiContractAddress).safeTransfer(darknodeOwner, amount);
        emit LogDarknodeWithdrew(msg.sender, amount);
    }

    /// @notice Claims the rewards allocated to the darknode last cycle and increments
    /// the darknode balances. Whitelists the darknode if it hasn't already been
    /// whitelisted. If a darknode does not call claim() then the rewards for the previous cycle is lost.
    function claim(address _darknode) external onlyDarknode(_darknode) notBlacklisted(_darknode) {
        uint256 fetchedCurrentCycle = fetchAndUpdateCurrentCycle();
        uint256 whitelistedCycle = darknodePayroll.darknodeWhitelist(_darknode);

        if (whitelistedCycle == fetchedCurrentCycle) {
            // Can't claim rewards until next cycle
            return;            
        }

        // The darknode hasn't been whitelisted before
        if (whitelistedCycle == 0) {
            privateWhitelistDarknode(_darknode);
            return;
        }

        // Claim share of rewards allocated for last cycle
        privateClaimDarknodeReward(_darknode);
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
    /// Remaining rewards are allocated to the darknode before the blacklist occurs.
    /// Only the darknodeJury can call this function.
    ///
    /// @param _darknode The address of the darknode to blacklist
    function blacklist(address _darknode) external onlyJury {
        // Allocate their remaining rewards before blacklisting them
        if (!rewardClaimed[previousCycle][_darknode]) {
            privateClaimDarknodeReward(_darknode);
        }
        darknodePayroll.blacklist(_darknode);
    }

    /// @notice Removes a darknode from the blacklist.
    /// Only the darknodeJury can call this function.
    ///
    /// @param _darknode The address of the darknode to unblacklist
    function unBlacklist(address _darknode) external onlyJury {
        darknodePayroll.unBlacklist(_darknode);
    }

    /// @notice Manually whitelists a darknode for rewards.
    /// Only the darknodeJury can call this function.
    ///
    /// @param _darknode The address of the darknode to whitelist
    function whitelist(address _darknode) external onlyJury {
        privateWhitelistDarknode(_darknode);
    }

    /// @notice Changes the current cycle
    function privateUpdateCycle() private {
        (uint256 dnrCurrentEpoch, ) = darknodeRegistry.currentEpoch();
        require(dnrCurrentEpoch != currentCycle, "cycle should have changed");

        if (darknodePayroll.whitelistTotal() == 0) {
            previousCycleRewardPool = 0;
            previousCycleRewardShare = 0;
        } else {
            // Lock up the current balance for darknode reward allocation
            uint256 currentBalance = CompatibleERC20(daiContractAddress).balanceOf(address(this));
            previousCycleRewardPool = currentBalance - rewardsClaimed;
            previousCycleRewardShare = previousCycleRewardPool / darknodePayroll.whitelistTotal();
        }

        // Update the cycle
        previousCycle = currentCycle;
        currentCycle = dnrCurrentEpoch;
        currentCycleStartTime = nextCycleStartTime;
        nextCycleStartTime += cycleDuration;

        // Update pending whitelist/blacklist numbers
        darknodePayroll.update();

        emit LogNewCycle(currentCycle, previousCycle, previousCycleRewardPool, previousCycleRewardShare);
    }

    function privateClaimDarknodeReward(address _addr) private {
        require(!rewardClaimed[previousCycle][_addr], "reward already claimed");
        rewardClaimed[previousCycle][_addr] = true;

        darknodeBalances[_addr] += previousCycleRewardShare;
        rewardsClaimed += previousCycleRewardShare;
        previousCycleRewardPool -= previousCycleRewardShare;

        emit LogDarknodeClaim(_addr, previousCycleRewardShare, darknodeBalances[_addr]);
    }

    function privateWhitelistDarknode(address _darknode) private {
        uint256 fetchedCurrentCycle = fetchAndUpdateCurrentCycle();
        darknodePayroll.whitelist(_darknode, fetchedCurrentCycle);
    }

    /// @notice Allow the contract owner to update the darknodeJury address
    /// address.
    /// @param _addr The new darknodeJury contract address.
    function updateDarknodeJury(address _addr) external onlyOwner {
        require(_addr != 0x0, "invalid contract address");
        darknodeJury = _addr;
    }

}
