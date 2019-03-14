pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./CompatibleERC20.sol";
import "./DarknodeRegistry.sol";

/// @notice DarknodePayment is responsible for paying off darknodes for their computation.
contract DarknodePayment is Ownable {
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

    // The balance of the last epoch locked up for darknodes to withdraw
    uint256 public previousEpochContractBalance;
    // The amount that darknodes have added to their account from last epoch
    uint256 public previousEpochAllocatedAmount;

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

    /// @notice Only allow darknode registry to call
    modifier onlyDarknodeRegistry() {
        require(address(darknodeRegistry) == msg.sender, "not darknode registry");
        _;
    }

    /// @notice Only allow darknodes which haven't already ticked
    modifier notYetTicked() {
        (uint256 currentEpochHash, ) = darknodeRegistry.currentEpoch();
        require(!darknodeTicked[currentEpochHash][msg.sender], "already ticked");
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

        address payer = msg.sender;
        uint256 receivedValue = CompatibleERC20(daiContractAddress).safeTransferFromWithFees(payer, this, _value);

        emit LogPaymentReceived(payer, receivedValue);
    }

    /// @notice Sets the previous epoch balance as the current balance and
    /// resets the amount that has been allocated to zero. This function must only be
    /// called as a part of the darknodeRegistry's epoch() function at most once per day.
    function epoch() external onlyDarknodeRegistry {
        uint256 balance = CompatibleERC20(daiContractAddress).balanceOf(address(this));
        previousEpochContractBalance = balance;
        previousEpochAllocatedAmount = 0;
    }

    function balance() external view returns (uint256) {
        uint256 currentBalance = CompatibleERC20(daiContractAddress).balanceOf(address(this));
        return currentBalance - (previousEpochContractBalance - previousEpochAllocatedAmount);
    }

    function withdraw() external onlyDarknode {
        uint256 amount = darknodeBalances[msg.sender];
        require(amount > 0, "nothing to withdraw");

        darknodeBalances[msg.sender] = 0;
        CompatibleERC20(daiContractAddress).safeTransfer(msg.sender, amount);
        emit LogDarknodeWithdrew(msg.sender, amount);
    }

    /// @notice Sets the darknode as active in order to be paid a portion of fees
    /// and allocates the rewards for the previous epoch to the calling darknode
    function tick() external onlyDarknode notYetTicked {
        address darknode = msg.sender;

        // Tick for the current epoch
        (uint256 currentEpoch, ) = darknodeRegistry.currentEpoch();
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

            uint256 reward = (previousEpochContractBalance / totalDarknodeTicks[previousEpochHash]);
            darknodeBalances[darknode] += reward;
            previousEpochAllocatedAmount += reward;
        }
    }
}
