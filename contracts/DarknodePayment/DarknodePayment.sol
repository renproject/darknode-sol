pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

import "../libraries/ERC20WithFees.sol";
import "../DarknodeRegistry/DarknodeRegistry.sol";
import "./DarknodePaymentStore.sol";

/// @notice DarknodePayment is responsible for paying off darknodes for their
///         computation.
contract DarknodePayment is Claimable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;
    using ERC20WithFees for ERC20;

    string public VERSION; // Passed in as a constructor parameter.

    /// @notice The special address for Ether.
    address constant public ETHEREUM = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    DarknodeRegistry public darknodeRegistry; // Passed in as a constructor parameter.

    /// @notice DarknodePaymentStore is the storage contract for darknode
    ///         payments.
    DarknodePaymentStore public store; // Passed in as a constructor parameter.

    /// @notice The address that can call changeCycle()
    //          This defaults to the owner but should be changed to the DarknodeRegistry.
    address public cycleChanger;

    uint256 public currentCycle;
    uint256 public previousCycle;

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

    /// @notice The staged payout percentage to the darknodes per cycle
    uint256 public nextCyclePayoutPercent;

    /// @notice The current cycle payout percentage to the darknodes
    uint256 public currentCyclePayoutPercent;

    /// @notice Mapping of darknode -> cycle -> already_claimed
    ///         Used to keep track of which darknodes have already claimed their
    ///         rewards.
    mapping(address => mapping(uint256 => bool)) public rewardClaimed;

    /// @notice Emitted when a darknode claims their share of reward
    /// @param _darknode The darknode which claimed
    /// @param _cycle The cycle that the darknode claimed for
    event LogDarknodeClaim(address indexed _darknode, uint256 _cycle);

    /// @notice Emitted when someone pays the DarknodePayment contract
    /// @param _payer The darknode which claimed
    /// @param _amount The cycle that the darknode claimed for
    /// @param _token The address of the token that was transferred
    event LogPaymentReceived(address indexed _payer, uint256 _amount, address indexed _token);

    /// @notice Emitted when a darknode calls withdraw
    /// @param _payee The address of the darknode which withdrew
    /// @param _value The amount of DAI withdrawn
    /// @param _token The address of the token that was withdrawn
    event LogDarknodeWithdrew(address indexed _payee, uint256 _value, address indexed _token);

    /// @notice Emitted when the payout percent changes
    /// @param _newPercent The new percent
    /// @param _oldPercent The old percent
    event LogPayoutPercentChanged(uint256 _newPercent, uint256 _oldPercent);

    /// @notice Emitted when the CycleChanger address changes
    /// @param _newCycleChanger The new CycleChanger
    /// @param _oldCycleChanger The old CycleChanger
    event LogCycleChangerChanged(address indexed _newCycleChanger, address indexed _oldCycleChanger);

    /// @notice Emitted when a new token is registered
    /// @param _token The token that was registered
    event LogTokenRegistered(address indexed _token);

    /// @notice Emitted when a token is deregistered
    /// @param _token The token that was deregistered
    event LogTokenDeregistered(address indexed _token);

    /// @notice Emitted when the DarknodeRegistry is updated.
    /// @param _previousDarknodeRegistry The address of the old registry.
    /// @param _nextDarknodeRegistry The address of the new registry.
    event LogDarknodeRegistryUpdated(DarknodeRegistry indexed _previousDarknodeRegistry, DarknodeRegistry indexed _nextDarknodeRegistry);

    /// @notice Restrict a function registered dark nodes to call a function.
    modifier onlyDarknode(address _darknode) {
        require(darknodeRegistry.isRegistered(_darknode), "DarknodePayment: darknode is not registered");
        _;
    }

    /// @notice Restrict a function to have a valid percentage
    modifier validPercent(uint256 _percent) {
        require(_percent <= 100, "DarknodePayment: invalid percentage");
        _;
    }

    /// @notice Restrict a function to be called by cycleChanger
    modifier onlyCycleChanger {
        require(msg.sender == cycleChanger, "DarknodePayment: not cycle changer");
        _;
    }

    /// @notice The contract constructor. Starts the current cycle using the
    ///         time of deploy.
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _darknodeRegistry The address of the DarknodeRegistry contract
    /// @param _darknodePaymentStore The address of the DarknodePaymentStore
    ///        contract
    constructor(
        string memory _VERSION,
        DarknodeRegistry _darknodeRegistry,
        DarknodePaymentStore _darknodePaymentStore,
        uint256 _cyclePayoutPercent
    ) public validPercent(_cyclePayoutPercent) {
        VERSION = _VERSION;
        darknodeRegistry = _darknodeRegistry;
        store = _darknodePaymentStore;
        nextCyclePayoutPercent = _cyclePayoutPercent;
        // Default the cycleChanger to owner
        cycleChanger = msg.sender;

        // Start the current cycle
        (currentCycle, cycleStartTime) = darknodeRegistry.currentEpoch();
        currentCyclePayoutPercent = nextCyclePayoutPercent;
    }

    /// @notice Allows the contract owner to update the address of the
    /// darknode registry contract.
    /// @param _darknodeRegistry The address of the Darknode Registry
    /// contract.
    function updateDarknodeRegistry(DarknodeRegistry _darknodeRegistry) external onlyOwner {
        require(address(_darknodeRegistry) != address(0x0), "DarknodePayment: invalid Darknode Registry address");
        DarknodeRegistry previousDarknodeRegistry = darknodeRegistry;
        darknodeRegistry = _darknodeRegistry;
        emit LogDarknodeRegistryUpdated(previousDarknodeRegistry, darknodeRegistry);
    }

    /// @notice Transfers the funds allocated to the darknode to the darknode
    ///         owner.
    ///
    /// @param _darknode The address of the darknode
    /// @param _token Which token to transfer
    function withdraw(address _darknode, address _token) public {
        address payable darknodeOwner = darknodeRegistry.getDarknodeOwner(_darknode);
        require(darknodeOwner != address(0x0), "DarknodePayment: invalid darknode owner");

        uint256 amount = store.darknodeBalances(_darknode, _token);
        require(amount > 0, "DarknodePayment: nothing to withdraw");

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
        uint256 total = store.availableBalance(_token).sub(unclaimedRewards[_token]);
        return total.div(100).mul(currentCyclePayoutPercent);
    }

    function darknodeBalances(address _darknodeID, address _token) external view returns (uint256) {
        return store.darknodeBalances(_darknodeID, _token);
    }

    /// @notice Changes the current cycle.
    function changeCycle() external onlyCycleChanger returns (uint256) {

        // Snapshot balances for the past cycle
        uint arrayLength = registeredTokens.length;
        for (uint i = 0; i < arrayLength; i++) {
            _snapshotBalance(registeredTokens[i]);
        }

        // Start a new cycle
        previousCycle = currentCycle;
        (currentCycle, cycleStartTime) = darknodeRegistry.currentEpoch();
        currentCyclePayoutPercent = nextCyclePayoutPercent;

        // Update the list of registeredTokens
        _updateTokenList();
        return currentCycle;
    }

    /// @notice Deposits token into the contract to be paid to the Darknodes
    ///
    /// @param _value The amount of token deposit in the token's smallest unit.
    /// @param _token The token address
    function deposit(uint256 _value, address _token) external payable {
        uint256 receivedValue;
        if (_token == ETHEREUM) {
            require(_value == msg.value, "DarknodePayment: mismatched deposit value");
            receivedValue = msg.value;
            address(store).transfer(msg.value);
        } else {
            require(msg.value == 0, "DarknodePayment: unexpected ether transfer");
            require(registeredTokenIndex[_token] != 0, "DarknodePayment: token not registered");
            // Forward the funds to the store
            receivedValue = ERC20(_token).safeTransferFromWithFees(msg.sender, address(store), _value);
        }
        emit LogPaymentReceived(msg.sender, receivedValue, _token);
    }

    /// @notice Forwards any tokens that have been sent to the DarknodePayment contract
    ///         probably by mistake, to the DarknodePaymentStore.
    ///
    /// @param _token The token address
    function forward(address _token) external {
        if (_token == ETHEREUM) {
            // Its unlikely that ETH will need to be forwarded, but it is
            // possible. For example - if ETH had already been sent to the
            // contract's address before it was deployed, or if funds are sent
            // to it as part of a contract's self-destruct.
            address(store).transfer(address(this).balance);
        } else {
            ERC20(_token).safeTransfer(address(store), ERC20(_token).balanceOf(address(this)));
        }
    }

    /// @notice Claims the rewards allocated to the darknode last epoch.
    /// @param _darknode The address of the darknode to claim
    function claim(address _darknode) external onlyDarknode(_darknode) {
        require(darknodeRegistry.isRegisteredInPreviousEpoch(_darknode), "DarknodePayment: cannot claim for this epoch");
        // Claim share of rewards allocated for last cycle
        _claimDarknodeReward(_darknode);
        emit LogDarknodeClaim(_darknode, previousCycle);
    }

    /// @notice Adds tokens to be payable. Registration is pending until next
    ///         cycle.
    ///
    /// @param _token The address of the token to be registered.
    function registerToken(address _token) external onlyOwner {
        require(registeredTokenIndex[_token] == 0, "DarknodePayment: token already registered");
        require(!tokenPendingRegistration(_token), "DarknodePayment: token already pending registration");
        pendingTokens.push(_token);
    }

    function tokenPendingRegistration(address _token) public view returns (bool) {
        uint arrayLength = pendingTokens.length;
        for (uint i = 0; i < arrayLength; i++) {
            if (pendingTokens[i] == _token) {
                return true;
            }
        }
        return false;
    }

    /// @notice Removes a token from the list of supported tokens.
    ///         Deregistration is pending until next cycle.
    ///
    /// @param _token The address of the token to be deregistered.
    function deregisterToken(address _token) external onlyOwner {
        require(registeredTokenIndex[_token] > 0, "DarknodePayment: token not registered");
        _deregisterToken(_token);
    }

    /// @notice Updates the CycleChanger contract address.
    ///
    /// @param _addr The new CycleChanger contract address.
    function updateCycleChanger(address _addr) external onlyOwner {
        require(_addr != address(0), "DarknodePayment: invalid contract address");
        emit LogCycleChangerChanged(_addr, cycleChanger);
        cycleChanger = _addr;
    }

    /// @notice Updates payout percentage
    ///
    /// @param _percent The percentage of payout for darknodes.
    function updatePayoutPercentage(uint256 _percent) external onlyOwner validPercent(_percent) {
        uint256 oldPayoutPercent = nextCyclePayoutPercent;
        nextCyclePayoutPercent = _percent;
        emit LogPayoutPercentChanged(nextCyclePayoutPercent, oldPayoutPercent);
    }

    /// @notice Allows the contract owner to initiate an ownership transfer of
    ///         the DarknodePaymentStore.
    ///
    /// @param _newOwner The address to transfer the ownership to.
    function transferStoreOwnership(DarknodePayment _newOwner) external onlyOwner {
        store.transferOwnership(address(_newOwner));
        _newOwner.claimStoreOwnership();
    }

    /// @notice Claims ownership of the store passed in to the constructor.
    ///         `transferStoreOwnership` must have previously been called when
    ///         transferring from another DarknodePaymentStore.
    function claimStoreOwnership() external {
        store.claimOwnership();
    }

    /// @notice Claims the darknode reward for all registered tokens into
    ///         darknodeBalances in the DarknodePaymentStore.
    ///         Rewards can only be claimed once per cycle.
    ///
    /// @param _darknode The address to the darknode to claim rewards for
    function _claimDarknodeReward(address _darknode) private {
        require(!rewardClaimed[_darknode][previousCycle], "DarknodePayment: reward already claimed");
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
        uint256 shareCount = darknodeRegistry.numDarknodesPreviousEpoch();
        if (shareCount == 0) {
            unclaimedRewards[_token] = 0;
            previousCycleRewardShare[_token] = 0;
        } else {
            // Lock up the current balance for darknode reward allocation
            uint256 total = store.availableBalance(_token);
            unclaimedRewards[_token] = total.div(100).mul(currentCyclePayoutPercent);
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
        registeredTokens.pop();
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
