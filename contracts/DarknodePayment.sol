pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./CompatibleERC20.sol";
import "./DarknodeRegistry.sol";

/// @notice DarknodePayment is responsible for paying off darknodes for their computation.
contract DarknodePayment {
    using SafeMath for uint256;
    using CompatibleERC20Functions for CompatibleERC20;

    string public VERSION; // Passed in as a constructor parameter.

    address public daiContractAddress; // Passed in as a constructor parameter.

    DarknodeRegistry public darknodeRegistry; // Passed in as a constructor parameter.

    // Mapping from epoch -> address -> hasTicked
    mapping(uint256 => mapping(address => bool)) public darknodeTicked;

    // Mapping from epoch -> totalNumberOfTicks
    mapping(uint256 => uint256) public totalDarknodeTicks;

    // Mapping from darknodeAddress -> accountBalance
    mapping(address => uint256) public darknodeBalances;

    // The hash of the current epoch
    uint256 public currentEpochHash;

    // The rewards from last epoch locked up for darknodes to claim
    uint256 public previousEpochRewardPool;
    // The amount that each darknode was rewarded last epoch
    uint256 public previousEpochRewardShare;
    // The amount that has been claimed by darknodes but not yet withdrawn
    uint256 public rewardsClaimed;

    /// @notice Emitted when a payment was made to the contract
    /// @param _payer The address of who made the payment
    /// @param _value The amount of DAI paid to the contract
    event LogPaymentReceived(address _payer, uint256 _value);

    /// @notice Emitted when a darknode calls withdraw
    /// @param _payee The address of the darknode which withdrew
    /// @param _value The amount of DAI withdrawn
    event LogDarknodeWithdrew(address _payee, uint256 _value);

    /// @notice Emitted when darknode calls the tick function
    /// @param _darknode The address of the darknode which ticked
    /// @param _epoch The current epoch hash
    /// @param _totalTicks The total number of ticks for this epoch
    event LogDarknodeTick(address _darknode, uint256 _epoch, uint256 _totalTicks);

    /// @notice Only allow registered dark nodes.
    modifier onlyDarknode() {
        require(darknodeRegistry.isRegistered(msg.sender), "not a registered darknode");
        _;
    }

    /// @notice Only allow darknodes which haven't already ticked
    modifier notYetTicked() {
        (uint256 dnrCurrentEpochHash, ) = darknodeRegistry.currentEpoch();
        require(!darknodeTicked[dnrCurrentEpochHash][msg.sender], "already ticked");
        _;
    }

    /// @notice The contract constructor.
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _daiAddress The address of the DAI token contract.
    /// @param _darknodeRegistry The address of the Darknode Registry contract
    constructor(
        string _VERSION,
        address _daiAddress,
        DarknodeRegistry _darknodeRegistry
    ) public {
        VERSION = _VERSION;
        daiContractAddress = _daiAddress;
        darknodeRegistry = _darknodeRegistry;
    }

    /// @notice Deposits DAI into the contract to be paid to the Darknodes
    ///
    /// @param _value The amount of DAI deposit in the token's smallest unit.
    function deposit(uint256 _value) external payable {
        require(msg.value == 0, "unexpected ether transfer");
        uint256 receivedValue = CompatibleERC20(daiContractAddress).safeTransferFromWithFees(msg.sender, this, _value);
        emit LogPaymentReceived(msg.sender, receivedValue);
    }

    /// @notice The current balance of the contract available as reward for the current epoch.
    function currentEpochRewardPool() public view returns (uint256) {
        uint256 currentBalance = CompatibleERC20(daiContractAddress).balanceOf(address(this));
        (uint256 previousEpochHash, ) = darknodeRegistry.previousEpoch();
        // Don't lock up any reward if no darknodes ticked last epoch
        if (totalDarknodeTicks[previousEpochHash] == 0) {
            return currentBalance - rewardsClaimed;
        }
        // Lock up the reward for darknodes to claim
        return currentBalance - previousEpochRewardPool - rewardsClaimed;
    }

    /// @notice Transfers to the calling darknode the amount of DAI allocated to it as reward.
    function withdraw() external {
        uint256 amount = darknodeBalances[msg.sender];
        require(amount > 0, "nothing to withdraw");

        darknodeBalances[msg.sender] = 0;
        rewardsClaimed -= amount;
        CompatibleERC20(daiContractAddress).safeTransfer(msg.sender, amount);
        emit LogDarknodeWithdrew(msg.sender, amount);
    }

    /// @notice Sets the darknode as active in order to be paid a portion of fees
    /// and allocates the rewards for the previous epoch to the calling darknode
    function tick() external onlyDarknode notYetTicked {
        address darknode = msg.sender;

        // Tick for the current epoch
        uint256 currentEpoch = fetchAndUpdateCurrentEpochHash();
        darknodeTicked[currentEpoch][darknode] = true;
        totalDarknodeTicks[currentEpoch]++;
        emit LogDarknodeTick(darknode, currentEpoch, totalDarknodeTicks[currentEpoch]);

        // Claim rewards allocated for last epoch
        (uint256 previousEpochHash, uint256 previousEpochBlockNumber) = darknodeRegistry.previousEpoch();
        // Allocate rewards only if _darknode was active last epoch
        if (previousEpochBlockNumber != 0 && darknodeTicked[previousEpochHash][darknode]) {
            // Set them as inactive for last epoch to avoid potential double reclaims
            // FIXME: Is this statement actually necessary since tick() can only be called once per epoch anyway?
            darknodeTicked[previousEpochHash][darknode] = false;

            darknodeBalances[darknode] += previousEpochRewardShare;
            rewardsClaimed += previousEpochRewardShare;
            previousEpochRewardPool -= previousEpochRewardShare;
        }
    }

    function fetchAndUpdateCurrentEpochHash() public returns (uint256) {
        (uint256 dnrCurrentEpoch, ) = darknodeRegistry.currentEpoch();
        // If the epoch has changed
        if (currentEpochHash != dnrCurrentEpoch) {
            (uint256 dnrPreviousEpochHash, ) = darknodeRegistry.previousEpoch();
            // Lock up the current balance for darknode reward allocation
            previousEpochRewardPool = currentEpochRewardPool();
            if (totalDarknodeTicks[dnrPreviousEpochHash] > 0) {
                previousEpochRewardShare = previousEpochRewardPool / totalDarknodeTicks[dnrPreviousEpochHash];
            } else {
                previousEpochRewardShare = 0;
            }

            // Update the epoch
            currentEpochHash = dnrCurrentEpoch;
        }
        return dnrCurrentEpoch;
    }

}
