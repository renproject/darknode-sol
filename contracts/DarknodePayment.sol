pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./DarknodeRegistry.sol";
import "./DarknodePaymentStore.sol";
import "./CompatibleERC20.sol";

/// @notice DarknodePayment is responsible for whitelisting darknodes for rewards
/// and blacklisting darknodes who misbehave
contract DarknodePayment is Ownable {
    using SafeMath for uint256;
    using CompatibleERC20Functions for CompatibleERC20;

    string public VERSION; // Passed in as a constructor parameter.

    /// @notice The special address for Ether.
    address constant public ETHEREUM = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    DarknodeRegistry public darknodeRegistry; // Passed in as a constructor parameter.

    // DarknodePaymentStore is the storage contract for darknode payments.
    DarknodePaymentStore public store; // Passed in as a constructor parameter.

    address public darknodeJudge; // Contract that can call blacklist

    // The number of whitelisted darknodes this cycle
    uint256 public shareSize;

    uint256 public currentCycle;
    uint256 public previousCycle;

    address[] public supportedTokens;
    // The index starts from 1
    mapping(address => uint256) public supportedTokenIndex;

    // mapping from token -> amount
    mapping(address => uint256) public unclaimedRewards;
    mapping(address => uint256) public previousCycleRewardShare;

    uint256 public cycleDuration;
    uint256 public cycleTimeout;

    // mapping of cycle -> darknode -> already_claimed
    mapping(uint256 => mapping(address => bool)) public rewardClaimed;

    // Mapping from darknode -> token -> balances
    mapping(address => mapping(address => uint256)) public darknodeBalances;

    /// @notice Emitted when a darknode is blacklisted from receiving rewards
    /// @param _darknode The address of the darknode which was blacklisted
    /// @param _time The time at which the darknode was blacklisted
    event LogDarknodeBlacklisted(address _darknode, uint256 _time);

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
    modifier onlyDarknodeJudge() {
        require(darknodeJudge == msg.sender, "not DarknodeJudge");
        _;
    }

    /// @notice Only allow darknodes which haven't been blacklisted
    modifier notBlacklisted(address _darknode) {
        require(!store.isBlacklisted(_darknode), "darknode is blacklisted");
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
        DarknodePaymentStore _darknodePaymentStore,
        uint256 _cycleDuration
    ) public {
        VERSION = _VERSION;
        darknodeRegistry = _darknodeRegistry;
        store = _darknodePaymentStore;
        cycleDuration = _cycleDuration * 1 days;
        // Default the judge to owner
        darknodeJudge = msg.sender;

        // Start the current cycle
        (uint256 dnrCurrentEpoch, ) = darknodeRegistry.currentEpoch();
        currentCycle = dnrCurrentEpoch;
        cycleTimeout = now + cycleDuration;
    }

    /// @notice The current balance of the contract available as reward for the current cycle
    function currentCycleRewardPool(address _token) external view returns (uint256) {
        return store.availableBalance(_token) - unclaimedRewards[_token];
    }

    function blacklist(address _darknode) external onlyDarknodeJudge {
        store.blacklist(_darknode);
    }

    /// @notice Changes the current cycle.
    function changeCycle() external returns (uint256) {
        require(now >= cycleTimeout, "can't cycle yet");
        (uint256 dnrCurrentEpoch, ) = darknodeRegistry.currentEpoch();
        require(dnrCurrentEpoch != currentCycle, "no new epoch");

        // Snapshot balances for each token
        uint arrayLength = supportedTokens.length;
        for (uint i = 0; i < arrayLength; i++) {
            _snapshotBalance(supportedTokens[i]);
        }

        previousCycle = currentCycle;
        currentCycle = dnrCurrentEpoch;
        cycleTimeout = now + cycleDuration;

        // Update the share size for next cycle
        shareSize = store.darknodeWhitelistLength();

        emit LogNewCycle(currentCycle, previousCycle, cycleTimeout);
        return currentCycle;
    }

    /// @notice Transfers the funds allocated to a darknode owner
    ///
    /// @param _darknode The address of the darknode
    /// @param _token Which token to transfer
    function withdraw(address _darknode, address _token) external onlyDarknode(_darknode) {
        address darknodeOwner = darknodeRegistry.getDarknodeOwner(_darknode);
        require(darknodeOwner != 0x0, "invalid darknode owner");

        uint256 amount = darknodeBalances[_darknode][_token];
        require(amount > 0, "nothing to withdraw");

        store.transfer(_darknode, _token, amount, darknodeOwner);
        emit LogDarknodeWithdrew(_darknode, amount, _token);
    }

    /// @notice Deposits token into the contract to be paid to the Darknodes
    ///
    /// @param _value The amount of token deposit in the token's smallest unit.
    /// @param _token The token address
    function deposit(uint256 _value, address _token) external payable {
        uint256 receivedValue;
        if (_token == ETHEREUM) {
            receivedValue = msg.value;
            address(store).transfer(msg.value);
        } else {
            require(msg.value == 0, "unexpected ether transfer");
            receivedValue = CompatibleERC20(_token).safeTransferFromWithFees(msg.sender, this, _value);
            // Forward the funds to the store
            CompatibleERC20(_token).safeTransfer(address(store), receivedValue);
        }
        emit LogPaymentReceived(msg.sender, receivedValue, _token);
    }

    /// @notice Claims the rewards allocated to the darknode last cycle and increments
    /// the darknode balances. Whitelists the darknode if it hasn't already been
    /// whitelisted. If a darknode does not call claim() then the rewards for the previous cycle is lost.
    function claim(address _darknode) external notBlacklisted(_darknode) {
        uint256 whitelistedCycle = store.darknodeWhitelist(_darknode);

        // The darknode hasn't been whitelisted before
        if (whitelistedCycle == 0) {
            store.whitelist(_darknode, currentCycle);
            return;
        }

        require(whitelistedCycle != currentCycle, "can't claim for this cycle");

        // Claim share of rewards allocated for last cycle
        _claimDarknodeReward(_darknode);
        emit LogDarknodeClaim(_darknode, previousCycle);
    }

    /// @notice Adds more payable tokens.
    ///
    /// @param _token The address of the token to be registered.
    function registerToken(address _token) public onlyOwner {
        require(supportedTokenIndex[_token] == 0, "token already registered");
        supportedTokens.push(_token);
        supportedTokenIndex[_token] = supportedTokens.length;
    }

    /// @notice Removes a token from the list of supported tokens
    ///
    /// @param _token The address of the token to be deregistered.
    function deregisterToken(address _token) public onlyOwner {
        require(supportedTokenIndex[_token] > 0, "token not registered");
        uint256 deletedTokenIndex = supportedTokenIndex[_token] - 1;
        supportedTokens[deletedTokenIndex] = supportedTokens[supportedTokens.length-1];
        // Decreasing the length will clean up the storage for us
        // So we don't need to manually delete the element
        supportedTokens.length--;
        supportedTokenIndex[_token] = 0;
    }

    /// @notice Updates the DarknodeJudge contract address.
    ///
    /// @param _addr The new DarknodeJudge contract address.
    function updateDarknodeJudge(address _addr) external onlyOwner {
        require(_addr != 0x0, "invalid contract address");
        darknodeJudge = _addr;
    }

    /// @notice Updates cycle duration
    ///
    /// @param _duration The time before a new cycle can be called, in days
    function updateCycleDuration(uint256 _duration) external onlyOwner {
        cycleDuration = _duration * 1 days;
    }

    /// @notice Allows the contract owner to initiate an ownership transfer of
    /// the DarknodeRegistryStore. 
    /// @param _newOwner The address to transfer the ownership to.
    function transferStoreOwnership(address _newOwner) external onlyOwner {
        store.transferOwnership(_newOwner);
    }

    /// @notice Claims ownership of the store passed in to the constructor.
    /// `transferStoreOwnership` must have previously been called when
    /// transferring from another Darknode Registry.
    function claimStoreOwnership() external onlyOwner {
        store.claimOwnership();
    }

    function _claimDarknodeReward(address _darknode) private {
        require(!rewardClaimed[previousCycle][_darknode], "reward already claimed");
        rewardClaimed[previousCycle][_darknode] = true;
        uint arrayLength = supportedTokens.length;
        for (uint i = 0; i < arrayLength; i++) {
            address token = supportedTokens[i];
            require(unclaimedRewards[token] >= previousCycleRewardShare[token], "insufficient token balance");
            unclaimedRewards[token] -= previousCycleRewardShare[token];

            store.incrementDarknodeBalance(_darknode, token, previousCycleRewardShare[token]);
        }
    }

    function _snapshotBalance(address _token) private {
        if (shareSize == 0) {
            unclaimedRewards[_token] = 0;
            previousCycleRewardShare[_token] = 0;
        } else {
            // Lock up the current balance for darknode reward allocation
            unclaimedRewards[_token] = store.availableBalance(_token);
            previousCycleRewardShare[_token] = unclaimedRewards[_token] / shareSize;
        }
    }

}
