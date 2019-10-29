pragma solidity ^0.5.8;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import "../libraries/CompatibleERC20Functions.sol";
import "../DarknodeRegistry/DarknodeRegistry.sol";
import "./DarknodePaymentStore.sol";

/// @notice DarknodePayment is responsible for paying off darknodes for their
///         computation.
contract DarknodePayment is Ownable {
    using SafeMath for uint256;
    using CompatibleERC20Functions for ERC20;

    string public VERSION; // Passed in as a constructor parameter.

    /// @notice The special address for Ether.
    address constant public ETHEREUM = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    DarknodeRegistry public darknodeRegistry; // Passed in as a constructor parameter.

    /// @notice DarknodePaymentStore is the storage contract for darknode
    ///         payments.
    DarknodePaymentStore public store; // Passed in as a constructor parameter.

    /// @notice The address that can call blacklist()
    address public blacklister;

    uint256 public currentCycle;
    uint256 public previousCycle;

    /// @notice The number of whitelisted darknodes this cycle
    uint256 public shareCount;

    /// @notice The list of tokens that will be registered next cycle.
    ///         We only update the shareCount at the change of cycle to
    ///         prevent the number of shares from changing.
    address[] public pendingTokens;

    /// @notice The list of tokens which are already registered and rewards can
    ///         be claimed for.
    address[] public registeredTokens;

    /// @notice Mapping from token -> index. Index starts from 1. 0 means not in
    ///         list.
    mapping(address => uint256) public registeredTokenIndex;

    /// @notice Mapping from token -> amount.
    ///         The amount of rewards allocated for all darknodes to claim into
    ///         their account.
    mapping(address => uint256) public unclaimedRewards;

    /// @notice Mapping from token -> amount.
    ///         The amount of rewards allocated for each darknode.
    mapping(address => uint256) public previousCycleRewardShare;

    /// @notice The time that the current cycle started.
    uint256 public cycleStartTime;

    /// @notice The minimum duration that the current cycle must go for.
    uint256 public cycleDuration;

    /// @notice The earliest timestamp that changeCycle() can be called.
    uint256 public cycleTimeout;

    /// @notice Mapping of darknode -> cycle -> already_claimed
    ///         Used to keep track of which darknodes have already claimed their
    ///         rewards.
    mapping(address => mapping(uint256 => bool)) public rewardClaimed;

    /// @notice Emitted when a darknode is blacklisted from receiving rewards
    /// @param _darknode The address of the darknode which was blacklisted
    /// @param _time The time at which the darknode was blacklisted
    event LogDarknodeBlacklisted(address indexed _darknode, uint256 _time);

    /// @notice Emitted when a darknode is whitelisted to receive rewards
    /// @param _darknode The address of the darknode which was whitelisted
    /// @param _time The time at which the darknode was whitelisted
    event LogDarknodeWhitelisted(address indexed _darknode, uint256 _time);

    /// @notice Emitted when a darknode claims their share of reward
    /// @param _darknode The darknode which claimed
    /// @param _cycle The cycle that the darknode claimed for
    event LogDarknodeClaim(address indexed _darknode, uint256 _cycle);

    /// @notice Emitted when someone pays the DarknodePayment contract
    /// @param _payer The darknode which claimed
    /// @param _amount The cycle that the darknode claimed for
    /// @param _token The address of the token that was transferred
    event LogPaymentReceived(address indexed _payer, uint256 _amount, address _token);

    /// @notice Emitted when a darknode calls withdraw
    /// @param _payee The address of the darknode which withdrew
    /// @param _value The amount of DAI withdrawn
    /// @param _token The address of the token that was withdrawn
    event LogDarknodeWithdrew(address indexed _payee, uint256 _value, address _token);

    /// @notice Emitted when a new cycle happens
    /// @param _newCycle The new, current cycle
    /// @param _lastCycle The previous cycle
    /// @param _cycleTimeout The earliest a new cycle can be called
    event LogNewCycle(uint256 _newCycle, uint256 _lastCycle, uint256 _cycleTimeout);

    /// @notice Emitted when the cycle duration changes
    /// @param _newDuration The new duration
    /// @param _oldDuration The old duration
    event LogCycleDurationChanged(uint256 _newDuration, uint256 _oldDuration);

    /// @notice Emitted when the Blacklister contract changes
    /// @param _newBlacklister The new Blacklister
    /// @param _oldBlacklister The old Blacklister
    event LogBlacklisterChanged(address _newBlacklister, address _oldBlacklister);

    /// @notice Emitted when a new token is registered
    /// @param _token The token that was registered
    event LogTokenRegistered(address _token);

    /// @notice Emitted when a token is deregistered
    /// @param _token The token that was deregistered
    event LogTokenDeregistered(address _token);

    /// @notice Restrict a function registered dark nodes to call a function.
    modifier onlyDarknode(address _darknode) {
        require(darknodeRegistry.isRegistered(_darknode), "darknode is not registered");
        _;
    }

    /// @notice Restrict a function the blacklister.
    modifier onlyBlacklister() {
        require(blacklister == msg.sender, "not Blacklister");
        _;
    }

    /// @notice Restrict a function darknodes which haven't been blacklisted
    modifier notBlacklisted(address _darknode) {
        require(!store.isBlacklisted(_darknode), "darknode is blacklisted");
        _;
    }

    /// @notice The contract constructor. Starts the current cycle using the
    ///         time of deploy.
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _darknodeRegistry The address of the DarknodeRegistry contract
    /// @param _darknodePaymentStore The address of the DarknodePaymentStore
    ///        contract
    /// @param _cycleDurationSeconds The minimum time before a new cycle can occur in seconds
    constructor(
        string memory _VERSION,
        DarknodeRegistry _darknodeRegistry,
        DarknodePaymentStore _darknodePaymentStore,
        uint256 _cycleDurationSeconds
    ) public {
        VERSION = _VERSION;
        darknodeRegistry = _darknodeRegistry;
        store = _darknodePaymentStore;
        cycleDuration = _cycleDurationSeconds;
        // Default the blacklister to owner
        blacklister = msg.sender;

        // Start the current cycle
        currentCycle = block.number;
        cycleStartTime = block.timestamp;
        cycleTimeout = cycleStartTime.add(cycleDuration);
    }

    /// @notice Allow the owner of the contract to recover funds accidentally
    /// sent to the contract. To withdraw ETH, the token should be set to `0x0`.
    function recoverTokens(address _token) external onlyOwner {
        if (_token == address(0x0)) {
            msg.sender.transfer(address(this).balance);
        } else {
            ERC20(_token).transfer(msg.sender, ERC20(_token).balanceOf(address(this)));
        }
    }

    /// @notice Transfers the funds allocated to the darknode to the darknode
    ///         owner.
    ///
    /// @param _darknode The address of the darknode
    /// @param _token Which token to transfer
    function withdraw(address _darknode, address _token) public {
        address payable darknodeOwner = darknodeRegistry.getDarknodeOwner(_darknode);
        require(darknodeOwner != address(0x0), "invalid darknode owner");

        uint256 amount = store.darknodeBalances(_darknode, _token);
        require(amount > 0, "nothing to withdraw");

        store.transfer(_darknode, _token, amount, darknodeOwner);
        emit LogDarknodeWithdrew(_darknode, amount, _token);
    }

    function withdrawMultiple(address _darknode, address[] calldata _tokens) external {
        for (uint i = 0; i < _tokens.length; i++) {
            withdraw(_darknode, _tokens[i]);
        }
    }

    /// @notice Forward all payments to the DarknodePaymentStore.
    function () external payable {
        address(store).transfer(msg.value);
        emit LogPaymentReceived(msg.sender, msg.value, ETHEREUM);
    }

    /// @notice The current balance of the contract available as reward for the
    ///         current cycle
    function currentCycleRewardPool(address _token) external view returns (uint256) {
        return store.availableBalance(_token).sub(unclaimedRewards[_token]);
    }

    function darknodeBalances(address _darknodeID, address _token) external view returns (uint256) {
        return store.darknodeBalances(_darknodeID, _token);
    }

    /// @notice Changes the current cycle.
    function changeCycle() external returns (uint256) {
        require(now >= cycleTimeout, "cannot cycle yet: too early");
        require(block.number != currentCycle, "no new block");

        // Snapshot balances for the past cycle
        uint arrayLength = registeredTokens.length;
        for (uint i = 0; i < arrayLength; i++) {
            _snapshotBalance(registeredTokens[i]);
        }

        // Start a new cycle
        previousCycle = currentCycle;
        currentCycle = block.number;
        cycleStartTime = block.timestamp;
        cycleTimeout = cycleStartTime.add(cycleDuration);

        // Update the share size for next cycle
        shareCount = store.darknodeWhitelistLength();
        // Update the list of registeredTokens
        _updateTokenList();

        emit LogNewCycle(currentCycle, previousCycle, cycleTimeout);
        return currentCycle;
    }

    /// @notice Deposits token into the contract to be paid to the Darknodes
    ///
    /// @param _value The amount of token deposit in the token's smallest unit.
    /// @param _token The token address
    function deposit(uint256 _value, address _token) external payable {
        uint256 receivedValue;
        if (_token == ETHEREUM) {
            require(_value == msg.value, "mismatched deposit value");
            receivedValue = msg.value;
            address(store).transfer(msg.value);
        } else {
            require(msg.value == 0, "unexpected ether transfer");
            // Forward the funds to the store
            receivedValue = ERC20(_token).safeTransferFromWithFees(msg.sender, address(store), _value);
        }
        emit LogPaymentReceived(msg.sender, receivedValue, _token);
    }

    /// @notice Claims the rewards allocated to the darknode last cycle and
    ///         increments the darknode balances. Whitelists the darknode if it
    ///         hasn't already been whitelisted. If a darknode does not call
    ///         claim() then the rewards for the previous cycle is lost.
    ///
    /// @param _darknode The address of the darknode to claim
    function claim(address _darknode) external onlyDarknode(_darknode) notBlacklisted(_darknode) {
        uint256 whitelistedTime = store.darknodeWhitelist(_darknode);

        // The darknode hasn't been whitelisted before
        if (whitelistedTime == 0) {
            store.whitelist(_darknode);
            emit LogDarknodeWhitelisted(_darknode, now);
            return;
        }

        require(whitelistedTime < cycleStartTime, "cannot claim for this cycle");

        // Claim share of rewards allocated for last cycle
        _claimDarknodeReward(_darknode);
        emit LogDarknodeClaim(_darknode, previousCycle);
    }

    /// @notice Blacklists a darknode from participating in rewards.
    ///
    /// @param _darknode The address of the darknode to blacklist
    function blacklist(address _darknode) external onlyBlacklister onlyDarknode(_darknode) {
        store.blacklist(_darknode);
        emit LogDarknodeBlacklisted(_darknode, now);
    }

    /// @notice Adds tokens to be payable. Registration is pending until next
    ///         cycle.
    ///
    /// @param _token The address of the token to be registered.
    function registerToken(address _token) external onlyOwner {
        require(registeredTokenIndex[_token] == 0, "token already registered");
        uint arrayLength = pendingTokens.length;
        for (uint i = 0; i < arrayLength; i++) {
            require(pendingTokens[i] != _token, "token already pending registration");
        }
        pendingTokens.push(_token);
    }

    /// @notice Removes a token from the list of supported tokens.
    ///         Deregistration is pending until next cycle.
    ///
    /// @param _token The address of the token to be deregistered.
    function deregisterToken(address _token) external onlyOwner {
        require(registeredTokenIndex[_token] > 0, "token not registered");
        _deregisterToken(_token);
    }

    /// @notice Updates the Blacklister contract address.
    ///
    /// @param _addr The new Blacklister contract address.
    function updateBlacklister(address _addr) external onlyOwner {
        require(_addr != address(0), "invalid contract address");
        emit LogBlacklisterChanged(_addr, blacklister);
        blacklister = _addr;
    }

    /// @notice Updates cycle duration
    ///
    /// @param _durationSeconds The amount of time (in seconds) that should have
    ///        passed before a new cycle can be called.
    function updateCycleDuration(uint256 _durationSeconds) external onlyOwner {
        uint256 oldDuration = cycleDuration;
        cycleDuration = _durationSeconds;
        emit LogCycleDurationChanged(cycleDuration, oldDuration);
    }

    /// @notice Allows the contract owner to initiate an ownership transfer of
    ///         the DarknodePaymentStore.
    ///
    /// @param _newOwner The address to transfer the ownership to.
    function transferStoreOwnership(address _newOwner) external onlyOwner {
        store.transferOwnership(_newOwner);
    }

    /// @notice Claims ownership of the store passed in to the constructor.
    ///         `transferStoreOwnership` must have previously been called when
    ///         transferring from another DarknodePaymentStore.
    function claimStoreOwnership() external onlyOwner {
        store.claimOwnership();
    }

    /// @notice Claims the darknode reward for all registered tokens into
    ///         darknodeBalances in the DarknodePaymentStore.
    ///         Rewards can only be claimed once per cycle.
    ///
    /// @param _darknode The address to the darknode to claim rewards for
    function _claimDarknodeReward(address _darknode) private {
        require(!rewardClaimed[_darknode][previousCycle], "reward already claimed");
        rewardClaimed[_darknode][previousCycle] = true;
        uint arrayLength = registeredTokens.length;
        for (uint i = 0; i < arrayLength; i++) {
            address token = registeredTokens[i];

            // Only increment balance if shares were allocated last cycle
            if (previousCycleRewardShare[token] > 0) {
                unclaimedRewards[token] = unclaimedRewards[token].sub(previousCycleRewardShare[token]);
                store.incrementDarknodeBalance(_darknode, token, previousCycleRewardShare[token]);
            }
        }
    }

    /// @notice Snapshots the current balance of the tokens, for all registered
    ///         tokens.
    ///
    /// @param _token The address the token to snapshot.
    function _snapshotBalance(address _token) private {
        if (shareCount == 0) {
            unclaimedRewards[_token] = 0;
            previousCycleRewardShare[_token] = 0;
        } else {
            // Lock up the current balance for darknode reward allocation
            unclaimedRewards[_token] = store.availableBalance(_token);
            previousCycleRewardShare[_token] = unclaimedRewards[_token].div(shareCount);
        }
    }

    /// @notice Deregisters a token, removing it from the list of
    ///         registeredTokens.
    ///
    /// @param _token The address of the token to deregister.
    function _deregisterToken(address _token) private {
        address lastToken = registeredTokens[registeredTokens.length.sub(1)];
        uint256 deletedTokenIndex = registeredTokenIndex[_token].sub(1);
        // Move the last token to _token's position and update it's index
        registeredTokens[deletedTokenIndex] = lastToken;
        registeredTokenIndex[lastToken] = registeredTokenIndex[_token];
        // Decreasing the length will clean up the storage for us
        // So we don't need to manually delete the element
        registeredTokens.length = registeredTokens.length.sub(1);
        registeredTokenIndex[_token] = 0;

        emit LogTokenDeregistered(_token);
    }

    /// @notice Updates the list of registeredTokens adding tokens that are to be registered.
    ///         The list of tokens that are pending registration are emptied afterwards.
    function _updateTokenList() private {
        // Register tokens
        uint arrayLength = pendingTokens.length;
        for (uint i = 0; i < arrayLength; i++) {
            address token = pendingTokens[i];
            registeredTokens.push(token);
            registeredTokenIndex[token] = registeredTokens.length;
            emit LogTokenRegistered(token);
        }
        pendingTokens.length = 0;
    }

}
