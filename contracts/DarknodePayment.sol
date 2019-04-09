pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./DarknodeRegistry.sol";
import "./CompatibleERC20.sol";

/// @notice DarknodePayment is responsible for whitelisting darknodes for rewards
/// and blacklisting darknodes who misbehave
contract DarknodePayment is Ownable {
    using SafeMath for uint256;
    using CompatibleERC20Functions for CompatibleERC20;

    string public VERSION; // Passed in as a constructor parameter.

    DarknodeRegistry public darknodeRegistry; // Passed in as a constructor parameter.

    address public darknodePaymentStore; // Contract that can call whitelist, claim
    address public darknodeJudge; // Contract that can call blacklist

    // temporary values
    address public pendingDarknodePaymentStore;
    address public pendingDarknodeJudge;
    uint256 public pendingCycleDuration;

    // The current total of whitelisted darknodes
    uint256 public whitelistTotal;

    // The pending number of whitelist darknodes
    uint256 public pendingWhitelist;
    // The pending number of darknodes to be blacklisted
    uint256 public pendingBlacklist;

    uint256 public currentCycle;
    uint256 public previousCycle;

    address[] public supportedTokens;
    mapping(address => bool) public tokenIsSupported;

    // token to amount
    mapping(address => uint256) public previousCycleRewardPool;
    mapping(address => uint256) public previousCycleRewardShare;
    // rewards that have already been allocated
    mapping(address => uint256) public rewardsClaimed;

    uint256 public cycleDuration;
    uint256 public cycleTimeout;

    // Mapping from address -> isBlacklisted
    mapping(address => bool) public isBlacklisted;

    // Mapping from darknode -> token -> balances
    mapping(address => mapping(address => uint256)) public darknodeBalances;

    // Mapping from darknodeAddress -> cycleWhenWhitelisted
    mapping(address => uint256) public darknodeWhitelist;

    /// @notice Emitted when a darknode is blacklisted from receiving rewards
    /// @param _darknode The address of the darknode which was blacklisted
    /// @param _time The time at which the darknode was blacklisted
    event LogDarknodeBlacklisted(address _darknode, uint256 _time);

    /// @notice Emitted when a darknode is unblacklisted from receiving rewards
    /// @param _darknode The address of the darknode which was unblacklisted
    /// @param _time The time at which the darknode was unblacklisted
    event LogDarknodeUnBlacklisted(address _darknode, uint256 _time);

    /// @notice Emitted when a darknode is whitelisted to receive rewards
    /// @param _darknode The address of the darknode which was whitelisted
    /// @param _cycle The cycle in which the darknode was whitelisted
    /// @param _time The time at which the darknode was whitelisted
    event LogDarknodeWhitelisted(address _darknode, uint256 _cycle, uint256 _time);

    /// @notice Emitted when a darknode claims their share of reward
    /// @param _darknode The darknode which claimed
    /// @param _cycle The cycle that the darknode claimed for
    event LogDarknodeClaim(address _darknode, uint256 _cycle);

    /// @notice Emitted when someone pays the DarknodePayment contract
    /// @param _payer The darknode which claimed
    /// @param _amount The cycle that the darknode claimed for
    /// @param _token The address of the token that was transferred
    event LogPaymentReceived(address _payer, uint256 _amount, address _token);

    /// @notice Emitted when a darknode is updated
    /// @param _oldTotal The previous total number of whitelisted darknodes
    /// @param _newTotal The new total number of whitelisted darknodes
    event LogDarknodeWhitelistUpdated(uint256 _oldTotal, uint256 _newTotal);

    /// @notice Emitted when a darknode calls withdraw
    /// @param _payee The address of the darknode which withdrew
    /// @param _value The amount of DAI withdrawn
    /// @param _token The address of the token that was withdrawn
    event LogDarknodeWithdrew(address _payee, uint256 _value, address _token);

    /// @notice Emitted when a new cycle happens
    /// @param _newCycle The new, current cycle
    /// @param _lastCycle The previous cycle
    /// @param _cycleTimeout The earliest a new cycle can be called
    event LogNewCycle(uint256 _newCycle, uint256 _lastCycle, uint256 _cycleTimeout);

    /// @notice Emitted when the cycle duration changes
    /// @param _newDuration The new duration
    /// @param _oldDuration The old duration
    event LogCycleDurationChanged(uint256 _newDuration, uint256 _oldDuration);

    /// @notice Emitted when the DarknodePaymentStore contract changes
    /// @param _newDarknodePaymentStore The new DarknodePaymentStore
    /// @param _oldDarknodePaymentStore The old DarknodePaymentStore
    event LogDarknodePaymentStoreChanged(address _newDarknodePaymentStore, address _oldDarknodePaymentStore);

    /// @notice Emitted when the DarknodeJudge contract changes
    /// @param _newDarknodeJudge The new DarknodeJudge
    /// @param _oldDarknodeJudge The old DarknodeJudge
    event LogDarknodeJudgeChanged(address _newDarknodeJudge, address _oldDarknodeJudge);

    /// @notice Only allow registered dark nodes.
    modifier onlyDarknode(address _addr) {
        require(darknodeRegistry.isRegistered(_addr), "not a registered darknode");
        _;
    }

    /// @notice Only allow the Darknode Payment contract.
    modifier onlyDarknodePaymentStore() {
        require(darknodePaymentStore == msg.sender, "not DarknodePaymentStore");
        _;
    }

    /// @notice Only allow the Darknode Payment contract.
    modifier onlyDarknodeJudge() {
        require(darknodeJudge == msg.sender, "not DarknodeJudge");
        _;
    }

    /// @notice The contract constructor.
    /// Starts the current cycle using the time of deploy and the current
    /// epoch according to the darknode registry
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _darknodeRegistry The address of the Darknode Registry contract
    /// @param _cycleDuration The minimum time before a new cycle can occur, in days
    constructor(
        string _VERSION,
        DarknodeRegistry _darknodeRegistry,
        uint256 _cycleDuration
    ) public {
        VERSION = _VERSION;
        darknodeRegistry = _darknodeRegistry;
        cycleDuration = _cycleDuration * 1 days;
        pendingCycleDuration = cycleDuration;
        // Default the judge to owner
        darknodeJudge = msg.sender;
        pendingDarknodeJudge = darknodeJudge;

        // Start the current cycle
        (uint256 dnrCurrentEpoch, ) = darknodeRegistry.currentEpoch();
        currentCycle = dnrCurrentEpoch;
        cycleTimeout = now + cycleDuration;
    }

    /// @notice Checks to see if a darknode is whitelisted
    ///
    /// @param _darknode The address of the darknode
    /// @return true if the darknode is whitelisted
    function isWhitelisted(address _darknode) public view returns (bool) {
        return darknodeWhitelist[_darknode] != 0;
    }

    /// @notice The current balance of the contract available as reward for the current cycle
    function currentCycleRewardPool(address _token) external view returns (uint256) {
        uint256 currentBalance = CompatibleERC20(_token).balanceOf(address(this));
        // Lock up the reward for darknodes to claim
        return currentBalance - previousCycleRewardPool[_token] - rewardsClaimed[_token];
    }

    /// @notice Changes the current cycle.
    function changeCycle() external returns (uint256) {
        uint256 startTime = now;
        require(startTime >= cycleTimeout, "can't cycle yet");
        (uint256 dnrCurrentEpoch, ) = darknodeRegistry.currentEpoch();
        require(dnrCurrentEpoch != currentCycle, "no new epoch");

        // Snapshot balances for each token
        uint arrayLength = supportedTokens.length;
        for (uint i = 0; i < arrayLength; i++) {
            _snapshotBalance(supportedTokens[i]);
        }

        // Update the cycle
        if (pendingCycleDuration != cycleDuration) {
            emit LogCycleDurationChanged(pendingCycleDuration, cycleDuration);
            cycleDuration = pendingCycleDuration;
        }
        if (pendingDarknodeJudge != darknodeJudge) {
            emit LogDarknodeJudgeChanged(pendingDarknodeJudge, darknodeJudge);
            darknodeJudge = pendingDarknodeJudge;
        }
        if (pendingDarknodePaymentStore != darknodePaymentStore) {
            emit LogDarknodePaymentStoreChanged(pendingDarknodePaymentStore, darknodePaymentStore);
            darknodePaymentStore = pendingDarknodePaymentStore;
        }

        previousCycle = currentCycle;
        currentCycle = dnrCurrentEpoch;
        cycleTimeout = startTime + cycleDuration;

        // Update pending whitelist/blacklist numbers
        whitelistTotal += (pendingWhitelist - pendingBlacklist);
        pendingWhitelist = 0;
        pendingBlacklist = 0;

        emit LogNewCycle(currentCycle, previousCycle, cycleTimeout);
        return currentCycle;
    }

    /// @notice Transfers the funds allocated to a darknode owner
    ///
    /// @param _darknode The address of the darknode
    /// @param _token Which token to transfer
    function transfer(address _darknode, address _token) external {
        address darknodeOwner = darknodeRegistry.getDarknodeOwner(_darknode);
        require(darknodeOwner != 0x0, "invalid darknode owner");

        uint256 amount = darknodeBalances[_darknode][_token];
        require(amount > 0, "nothing to withdraw");

        darknodeBalances[_darknode][_token] = 0;
        rewardsClaimed[_token] -= amount;

        CompatibleERC20(_token).safeTransfer(darknodeOwner, amount);
        emit LogDarknodeWithdrew(_darknode, amount, _token);
    }

    /// @notice Deposits token into the contract to be paid to the Darknodes
    ///
    /// @param _value The amount of token deposit in the token's smallest unit.
    /// @param _token The token address
    function deposit(uint256 _value, address _token) external payable {
        require(msg.value == 0, "unexpected ether transfer");
        uint256 receivedValue = CompatibleERC20(_token).safeTransferFromWithFees(msg.sender, this, _value);
        emit LogPaymentReceived(msg.sender, receivedValue, _token);
    }

    /// @notice Blacklists a darknode from receiving rewards
    ///
    /// @param _darknode The darknode to be blacklisted
    function blacklist(address _darknode) external onlyDarknodeJudge onlyDarknode(_darknode) {
        require(!isBlacklisted[_darknode], "already blacklisted");

        if (isWhitelisted(_darknode)) {
            pendingBlacklist += 1;
            darknodeWhitelist[_darknode] = 0;
        }
        
        isBlacklisted[_darknode] = true;

        emit LogDarknodeBlacklisted(_darknode, now);
    }

    /// @notice whitelist a darknode to receive rewards
    ///
    /// @param _darknode the darknode to be whitelisted
    function whitelist(address _darknode) external onlyDarknodePaymentStore onlyDarknode(_darknode) {
        require(!isBlacklisted[_darknode], "darknode is blacklisted");
        require(!isWhitelisted(_darknode), "already whitelisted");

        darknodeWhitelist[_darknode] = currentCycle;
        pendingWhitelist += 1;
        emit LogDarknodeWhitelisted(_darknode, currentCycle, now);
    }

    /// @notice Claims the share amount to the darknode
    ///
    /// @param _darknode The address of the darknode
    function claim(address _darknode) external onlyDarknodePaymentStore onlyDarknode(_darknode) {
        uint arrayLength = supportedTokens.length;
        for (uint i = 0; i < arrayLength; i++) {
            address token = supportedTokens[i];
            darknodeBalances[_darknode][token] += previousCycleRewardShare[token];
            rewardsClaimed[token] += previousCycleRewardShare[token];
            previousCycleRewardPool[token] -= previousCycleRewardShare[token];

        }
        emit LogDarknodeClaim(_darknode, previousCycle);
    }
    /// @notice Adds more payable tokens.
    ///
    /// @param _token The address of the token to be registered.
    function registerToken(address _token) public onlyOwner {
        require(!tokenIsSupported[_token], "token already registered");
        supportedTokens.push(_token);
        tokenIsSupported[_token] = true;
    }

    /// @notice Updates the DarknodePaymentStore contract address.
    ///
    /// @param _addr The new DarknodePaymentStore contract address.
    function updateDarknodePaymentStore(address _addr) external onlyOwner {
        require(_addr != 0x0, "invalid contract address");
        pendingDarknodePaymentStore = _addr;
    }

    /// @notice Updates the DarknodeJudge contract address.
    ///
    /// @param _addr The new DarknodeJudge contract address.
    function updateDarknodeJudge(address _addr) external onlyOwner {
        require(_addr != 0x0, "invalid contract address");
        pendingDarknodeJudge = _addr;
    }

    /// @notice Updates cycle duration
    ///
    /// @param _duration The time before a new cycle can be called, in days
    function updateCycleDuration(uint256 _duration) external onlyOwner {
        pendingCycleDuration = _duration * 1 days;
    }

    /// @notice Removes a blacklisted darknode from the blacklist
    ///
    /// @param _addr The darknode to be unblacklisted
    function unBlacklist(address _addr) external onlyOwner onlyDarknode(_addr) {
        require(isBlacklisted[_addr], "not in blacklist");

        isBlacklisted[_addr] = false;
        emit LogDarknodeUnBlacklisted(_addr, now);
    }

    /// @notice Snaphots the current balance of token
    ///
    /// @param _token The token to snapshot
    function _snapshotBalance(address _token) private {
        if (whitelistTotal == 0) {
            previousCycleRewardPool[_token] = 0;
            previousCycleRewardShare[_token] = 0;
        } else {
            // Lock up the current balance for darknode reward allocation
            uint256 currentBalance = CompatibleERC20(_token).balanceOf(address(this));
            previousCycleRewardPool[_token] = currentBalance - rewardsClaimed[_token];
            previousCycleRewardShare[_token] = previousCycleRewardPool[_token] / whitelistTotal;
        }
    }

}
