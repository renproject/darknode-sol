pragma solidity ^0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";

import "../DarknodeRegistry/DarknodeRegistry.sol";
import "./DarknodePaymentStore.sol";
import "../libraries/LinkedList.sol";
import "../Governance/Claimable.sol";

contract ClaimlessRewardsEvents {
    /// @notice Emitted when a node calls withdraw
    /// @param _payee The address of the node which withdrew
    /// @param _value The amount of DAI withdrawn
    /// @param _token The address of the token that was withdrawn
    event LogDarknodeWithdrew(
        address indexed _payee,
        uint256 _value,
        address indexed _token
    );

    /// @notice Emitted when the cycle is changed.
    /// @param _newTimestamp The start timestamp of the new cycle.
    /// @param _previousTimestamp The start timestamp of the previous cycle.
    /// @param _shareCount The number of darknodes at the end of the previous
    /// cycle.
    event LogCycleChanged(
        uint256 _newTimestamp,
        uint256 _previousTimestamp,
        uint256 _shareCount
    );

    /// @notice Emitted when the node payout percent changes.
    /// @param _newNumerator The new numerator.
    /// @param _oldNumerator The old numerator.
    event LogHourlyPayoutChanged(uint256 _newNumerator, uint256 _oldNumerator);

    /// @notice Emitted when the community fund percent changes.
    /// @param _newNumerator The new numerator.
    /// @param _oldNumerator The old numerator.
    event LogCommunityFundNumeratorChanged(
        uint256 _newNumerator,
        uint256 _oldNumerator
    );

    /// @notice Emitted when a new token is registered.
    /// @param _token The token that was registered.
    event LogTokenRegistered(address indexed _token);

    /// @notice Emitted when a token is deregistered.
    /// @param _token The token that was deregistered.
    event LogTokenDeregistered(address indexed _token);

    /// @notice Emitted when the DarknodeRegistry is updated.
    /// @param _previousDarknodeRegistry The address of the old registry.
    /// @param _nextDarknodeRegistry The address of the new registry.
    event LogDarknodeRegistryUpdated(
        DarknodeRegistryLogicV1 indexed _previousDarknodeRegistry,
        DarknodeRegistryLogicV1 indexed _nextDarknodeRegistry
    );

    /// @notice Emitted when the community fund recipient is updated.
    /// @param _previousCommunityFund The address of the old community fund.
    /// @param _nextCommunityFund The address of the new community fund.
    event LogCommunityFundUpdated(
        address indexed _previousCommunityFund,
        address indexed _nextCommunityFund
    );
}

contract ClaimlessRewardsState {
    using LinkedList for LinkedList.List;

    /// @notice The special address for the collective funds that haven't been
    /// withdrawn yet.
    address public constant POOLED_REWARDS = address(0);

    /// @notice The address of the Darknode Registry, used to look up the
    /// operators of nodes and the number of registered nodes.
    /// Passed in as a constructor parameter.
    DarknodeRegistryLogicV1 public darknodeRegistry;

    /// @notice DarknodePaymentStore stores the rewards until they are paid out.
    DarknodePaymentStore public store; // Passed in as a constructor parameter.

    /// @notice Mapping from token -> amount.
    /// The amount of rewards allocated for each node.
    mapping(uint256 => mapping(address => uint256))
        public cycleCumulativeTokenShares;

    /// @notice Mapping of node -> token -> last claimed timestamp
    /// Used to keep track of which nodes have already claimed their rewards.
    mapping(address => mapping(address => uint256)) public rewardsLastClaimed;

    uint256 public latestCycleTimestamp;
    uint256[] public epochTimestamps;

    /// @notice The list of tokens which are already registered and rewards can
    /// be claimed for.
    LinkedList.List internal registeredTokens;

    /// @notice The list of deregistered tokens, tracked to ensure that users
    /// can still withdraw rewards for tokens that have been deregistered.
    LinkedList.List internal deregisteredTokens;

    /// @notice The recipient of a proportion of rewards. The proportion can be
    /// updated, allowing this to be governed by a DAO.
    address public communityFund;

    /// @notice The denominator used by `hourlyPayoutWithheldNumerator` and
    /// `communityFundNumerator`.
    uint256 public constant HOURLY_PAYOUT_WITHHELD_DENOMINATOR = 1000000;

    /// @notice The proportion of the payout that is withheld each hour to be
    /// paid out over future cycles.
    /// The target payout is 50% over 28 days, so the following was calculated
    /// as `0.5 ** (1 / (28 * 24))`.
    /// Rounding is done in favor of the current cycle payout instead of the
    /// rewards withheld for future cycles.
    uint256 public hourlyPayoutWithheldNumerator = 998969;

    /// @notice The proportion of the reward pool that goes to the community
    /// fund. `communityFundNumerator` can be set to 0 to disable rewards going
    /// to the fund.
    uint256 public communityFundNumerator;
}

contract ClaimlessRewardsTokenHandler is
    Ownable,
    ClaimlessRewardsEvents,
    ClaimlessRewardsState
{
    using SafeERC20 for ERC20;

    /// @notice Adds tokens to be payable. Registration is pending until next
    /// cycle.
    ///
    /// @param _token The address of the token to be registered.
    function registerToken(address _token) external onlyOwner {
        require(
            !registeredTokens.isInList(_token),
            "ClaimlessRewards: token already registered"
        );
        registeredTokens.append(_token);

        // Remove from deregistered tokens.
        if (deregisteredTokens.isInList(_token)) {
            deregisteredTokens.remove(_token);
        }
    }

    /// @notice Removes a token from the list of supported tokens.
    /// Deregistration is pending until next cycle.
    ///
    /// @param _token The address of the token to be deregistered.
    function deregisterToken(address _token) external onlyOwner {
        require(
            registeredTokens.isInList(_token),
            "ClaimlessRewards: token not registered"
        );
        registeredTokens.remove(_token);

        // Add to deregistered tokens. This check should always be true.
        if (!deregisteredTokens.isInList(_token)) {
            deregisteredTokens.append(_token);
        }
    }

    /// @notice (external view) Returns the full list of registered tokens.
    function getRegisteredTokens() external view returns (address[] memory) {
        address[] memory tokens = new address[](registeredTokens.length);
        address nextToken = registeredTokens.begin();
        for (uint256 i = 0; i < tokens.length; i++) {
            tokens[i] = nextToken;

            // Take next token.
            nextToken = registeredTokens.next(nextToken);
        }
        return tokens;
    }

    /// @notice (external view) Returns whether a token is registered.
    function isRegistered(address _token) external view returns (bool) {
        return registeredTokens.isInList(_token);
    }

    /// @notice Forwards any balance held by this contract on to the store.
    ///
    /// @param _token The token to forward. For ETH, this is 0xeeee... .
    function forward(address _token) external {
        // If no token has been provided, forward ETH.
        if (_token == address(0x0)) {
            address(store).transfer(address(this).balance);
        } else {
            ERC20(_token).safeTransfer(
                address(store),
                ERC20(_token).balanceOf(address(this))
            );
        }
    }
}

contract ClaimlessRewardsAdminHandler is
    Ownable,
    ClaimlessRewardsEvents,
    ClaimlessRewardsState
{
    /// @notice Allows the contract owner to update the address of the
    /// Darknode Registry contract.
    /// @param _darknodeRegistry The address of the new Darknode Registry
    /// contract.
    function updateDarknodeRegistry(DarknodeRegistryLogicV1 _darknodeRegistry)
        external
        onlyOwner
    {
        _updateDarknodeRegistry(_darknodeRegistry);
    }

    /// @notice Allows the contract owner to update the address of the new dev
    /// fund.
    /// @param _communityFund The address of new community fund address.
    function updateCommunityFund(address _communityFund) external onlyOwner {
        _updateCommunityFund(_communityFund);
    }

    /// @notice Updates the proportion of the rewards that are withheld to be
    /// paid out over future cycles.
    ///
    /// @param _numerator The numerator of payout for darknodes.
    function updateHourlyPayoutWithheld(uint256 _numerator) external onlyOwner {
        require(
            _numerator <= HOURLY_PAYOUT_WITHHELD_DENOMINATOR,
            "ClaimlessRewards: invalid numerator"
        );

        // Emit before updating so that the old payout can be logged.
        emit LogHourlyPayoutChanged(_numerator, hourlyPayoutWithheldNumerator);
        hourlyPayoutWithheldNumerator = _numerator;
    }

    /// @notice Updates the proportion of the rewards that are withheld to be
    /// sent to the community fund.
    ///
    /// @param _numerator The numerator of payout for darknodes.
    function updateCommunityFundNumerator(uint256 _numerator)
        external
        onlyOwner
    {
        _updateCommunityFundNumerator(_numerator);
    }

    /// @notice Allows the contract owner to initiate an ownership transfer of
    /// the DarknodePaymentStore.
    ///
    /// @param _newOwner The address to transfer the ownership to.
    function transferStoreOwnership(ClaimlessRewardsAdminHandler _newOwner)
        external
        onlyOwner
    {
        store.transferOwnership(address(_newOwner));
        _newOwner.claimStoreOwnership();
    }

    /// @notice Claims ownership of the store passed in to the constructor.
    /// `transferStoreOwnership` must have previously been called when
    /// transferring from another DarknodePaymentStore.
    function claimStoreOwnership() external {
        store.claimOwnership();
    }

    /// @notice See `updateDarknodeRegistry`.
    function _updateDarknodeRegistry(DarknodeRegistryLogicV1 _darknodeRegistry)
        internal
    {
        require(
            address(_darknodeRegistry) != address(0x0),
            "ClaimlessRewards: invalid Darknode Registry address"
        );

        // Emit before updating so that the old registry can be logged.
        emit LogDarknodeRegistryUpdated(_darknodeRegistry, darknodeRegistry);
        darknodeRegistry = _darknodeRegistry;
    }

    /// @notice See `updateCommunityFund`.
    function _updateCommunityFund(address _communityFund) internal {
        // Ensure that the community fund is set properly, and that it's not the
        // POOLED_REWARDS address, which would allow the darknode rewards to
        // be withdrawn to the community fund.
        require(
            address(_communityFund) != address(0x0),
            "ClaimlessRewards: invalid community fund address"
        );

        // Ensure that the community fund isn't a registered node (this would
        // allow anyone to withdraw the node's legacy rewards to the node's
        // address - not a big issue, but disallowed nonetheless).
        require(
            darknodeRegistry.getDarknodeOperator(_communityFund) ==
                address(0x0),
            "ClaimlessRewards: community fund must not be a registered darknode"
        );

        // Emit before updating so that the old registry can be logged.
        emit LogCommunityFundUpdated(_communityFund, communityFund);
        communityFund = _communityFund;
    }

    /// @notice See `_updateCommunityFundNumerator`.
    function _updateCommunityFundNumerator(uint256 _numerator) internal {
        require(
            _numerator <= HOURLY_PAYOUT_WITHHELD_DENOMINATOR,
            "ClaimlessRewards: invalid numerator"
        );

        // Emit before updating so that the old payout can be logged.
        emit LogCommunityFundNumeratorChanged(
            _numerator,
            communityFundNumerator
        );
        communityFundNumerator = _numerator;
    }
}

contract ClaimlessRewardsCycleHandler is
    ClaimlessRewardsEvents,
    ClaimlessRewardsState
{
    using SafeMath for uint256;

    /// @notice (external view) Return the length of the array of cycle
    /// timestamps. This makes it easier for clients to loop through them.
    function epochTimestampsLength() external view returns (uint256) {
        return epochTimestamps.length;
    }

    /// @notice (external view) Returns the full array of timestamps. If this
    /// grows too large to return, they should be fetched one-by-one or by
    /// fetching tx logs.
    function getEpochTimestamps() external view returns (uint256[] memory) {
        return epochTimestamps;
    }

    /// @notice Changes the current cycle.
    /// Callable by anyone.
    function changeCycle() external returns (uint256) {
        uint256 numerator = hourlyPayoutWithheldNumerator;
        uint256 denominator = HOURLY_PAYOUT_WITHHELD_DENOMINATOR;

        uint256 newCycleTimestamp;
        uint256 rewardsWithheldNumerator = denominator;
        uint256 cycleTimestamp = latestCycleTimestamp;
        uint256 currentCommunityFundNumerator = communityFundNumerator;

        for (
            uint256 hour = cycleTimestamp;
            hour <= block.timestamp;
            hour += 1 hours
        ) {
            rewardsWithheldNumerator = rewardsWithheldNumerator
                .mul(numerator)
                .div(denominator);
            newCycleTimestamp = hour;
        }

        // If the caller is the Darknode Registry, set the cycle timestamp to be
        // the current timestamp so that the cycle and epoch are in sync
        // (instead of rounding down by up to an hour). This ensures that any
        // newly registered darknodes don't lose the fees until the next cycle.
        // The difference in time won't get counted in the rewards paiout
        // schedule.
        // Also, if the caller is the darknode registry, use the number of
        // darknodes in the previous epoch instead of the new once, since the
        // implementation calls `changeCycle` at the end of the epoch update,
        // not the start.
        uint256 shareCount;
        if (msg.sender == address(darknodeRegistry)) {
            newCycleTimestamp = block.timestamp;
            shareCount = darknodeRegistry.numDarknodesPreviousEpoch();
            epochTimestamps.push(newCycleTimestamp);
        } else {
            shareCount = darknodeRegistry.numDarknodes();
        }

        // Require that at least an hour has passed since the last cycle, or,
        // if being called from the epoch function, that cycle wasn't called
        // previously in the same block.
        require(
            newCycleTimestamp > cycleTimestamp,
            "ClaimlessRewards: previous cycle too recent"
        );

        // Snapshot balances for the past cycle
        address nextToken = registeredTokens.begin();
        while (nextToken != address(0x0)) {
            {
                uint256 total = store.availableBalance(nextToken);
                uint256 totalWithheld =
                    (total.mul(rewardsWithheldNumerator)).div(denominator);

                // The amount being paid out to the darknodes and the community
                // fund.
                uint256 totalPayout = total.sub(totalWithheld);

                // The amount being paid out to the community fund.
                uint256 communityFundPayout =
                    totalPayout.mul(currentCommunityFundNumerator).div(
                        denominator
                    );

                // The amount being paid out to the darknodes.
                uint256 nodePayout = totalPayout.sub(communityFundPayout);

                // The amount being paid out to each indidivual darknode.
                uint256 share =
                    shareCount == 0 ? 0 : nodePayout.div(shareCount);

                // The amount being paid out to the darknodes after ignoring
                // the amount left-over from dividing.
                uint256 nodePayoutAdjusted = share.mul(shareCount);

                // Store funds that can now be withdrawn by darknodes.
                if (nodePayoutAdjusted > 0) {
                    store.incrementDarknodeBalance(
                        POOLED_REWARDS,
                        nextToken,
                        nodePayoutAdjusted
                    );
                }

                // Store funds that can be withdrawn to the community fund.
                if (communityFundPayout > 0) {
                    store.incrementDarknodeBalance(
                        communityFund,
                        nextToken,
                        communityFundPayout
                    );
                }

                cycleCumulativeTokenShares[newCycleTimestamp][
                    nextToken
                ] = cycleCumulativeTokenShares[cycleTimestamp][nextToken].add(
                    share
                );
            }

            // Take next token.
            nextToken = registeredTokens.next(nextToken);
        }

        // Keep track of deregistered token amounts.
        address nextDeregisteredToken = deregisteredTokens.begin();
        while (nextDeregisteredToken != address(0x0)) {
            {
                cycleCumulativeTokenShares[newCycleTimestamp][
                    nextDeregisteredToken
                ] = cycleCumulativeTokenShares[cycleTimestamp][
                    nextDeregisteredToken
                ];
            }

            // Take next token.
            nextDeregisteredToken = deregisteredTokens.next(
                nextDeregisteredToken
            );
        }

        // Start a new cycle
        latestCycleTimestamp = newCycleTimestamp;

        emit LogCycleChanged(newCycleTimestamp, cycleTimestamp, shareCount);

        return newCycleTimestamp;
    }
}

contract ClaimlessRewardsWithdrawHandler is
    ClaimlessRewardsEvents,
    ClaimlessRewardsState,
    ClaimlessRewardsCycleHandler
{
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    // Return the next cycle with a timestamp greater than or equal to the
    // passed in timestamp.
    function getNextEpochFromTimestamp(uint256 _target)
        public
        view
        returns (uint256)
    {
        uint256 start = 0;
        uint256 end = epochTimestamps.length.sub(1);

        // Binary search. Relies on `epochTimestamps` being sorted.
        while (start <= end) {
            // Check if the middle element satisfies the conditions.
            uint256 mid = (start + end) / 2;
            if (
                epochTimestamps[mid] >= _target &&
                (mid == 0 || epochTimestamps[mid - 1] < _target)
            ) {
                return epochTimestamps[mid];
            }
            // Restrict the search space.
            else if (epochTimestamps[mid] < _target) {
                start = mid + 1;
            } else {
                end = mid.sub(1);
            }
        }
        return 0;
    }

    function darknodeBalances(address _node, address _token)
        external
        view
        returns (uint256)
    {
        uint256 nodeRegistered = darknodeRegistry.darknodeRegisteredAt(_node);

        uint256 newWithdrawable = 0;
        if (nodeRegistered > 0) {
            (newWithdrawable, ) = _calculateNewWithdrawable(_node, _token);
        }
        uint256 legacyWithdrawable = store.darknodeBalances(_node, _token);

        return newWithdrawable.add(legacyWithdrawable);
    }

    /// @notice Withdraw the provided asset for each node in the list.
    function withdrawToken(address[] memory _nodes, address _token) public {
        uint256 withdrawTotal = 0;

        for (uint256 i = 0; i < _nodes.length; i++) {
            address _node = _nodes[i];

            // The Darknode Registry already prevents IDs from being 0x0, but a
            // user could attempt to register the communityFund address as a
            // darknode and then withdraw the pending community fund rewards.
            require(
                _node != POOLED_REWARDS && _node != communityFund,
                "ClaimlessRewards: invalid node ID"
            );

            require(
                darknodeRegistry.getDarknodeOperator(_node) == msg.sender,
                "ClaimlessRewards: not operator"
            );

            (uint256 newRewards, uint256 claimUntil) =
                _calculateNewWithdrawable(_node, _token);

            withdrawTotal = withdrawTotal.add(newRewards);
            rewardsLastClaimed[_node][_token] = claimUntil;
            emit LogDarknodeWithdrew(_node, newRewards, _token);

            // Check if there's a legacy amount to withdraw. This only has
            // to be withdrawn once.
            uint256 legacyAmount = store.darknodeBalances(_node, _token);
            if (legacyAmount > 0) {
                store.transfer(_node, _token, legacyAmount, msg.sender);
                emit LogDarknodeWithdrew(_node, legacyAmount, _token);
            }
        }

        store.transfer(POOLED_REWARDS, _token, withdrawTotal, msg.sender);
    }

    /// @notice Withdraw multiple assets for each darknode in the list.
    /// The interface has been kept the same as the DarknodePayment contract
    /// for backward-compatibility.
    function withdrawMultiple(address[] memory _nodes, address[] memory _tokens)
        public
    {
        for (uint256 i = 0; i < _tokens.length; i++) {
            withdrawToken(_nodes, _tokens[i]);
        }
    }

    /// @notice Withdraw the provided asset for the given darknode.
    /// The interface has been kept the same as the DarknodePayment contract
    /// for backward-compatibility.
    function withdraw(address _node, address _token) public {
        address[] memory nodes = new address[](1);
        nodes[0] = _node;
        return withdrawToken(nodes, _token);
    }

    function withdrawToCommunityFund(address[] memory _tokens) public {
        // Access storage outside of loop.
        address memoryCommunityFund = communityFund;
        address payable communityFundPayable =
            address(uint160(address(memoryCommunityFund)));

        for (uint256 i = 0; i < _tokens.length; i++) {
            address _token = _tokens[i];
            uint256 amount =
                store.darknodeBalances(memoryCommunityFund, _token);

            if (amount > 0) {
                store.transfer(
                    memoryCommunityFund,
                    _token,
                    amount,
                    communityFundPayable
                );
            }
        }
    }

    function _calculateNewWithdrawable(address _node, address _token)
        internal
        view
        returns (uint256, uint256)
    {
        uint256 nodeRegistered = darknodeRegistry.darknodeRegisteredAt(_node);

        require(nodeRegistered > 0, "ClaimlessRewards: not registered");

        uint256 nodeDeregistered =
            darknodeRegistry.darknodeDeregisteredAt(_node);

        uint256 claimFrom = rewardsLastClaimed[_node][_token];
        if (claimFrom < nodeRegistered) {
            claimFrom = getNextEpochFromTimestamp(nodeRegistered);

            // A node can start claiming from the first epoch after (or at) its
            // registration time. If this is 0, then the node is still in the
            // pending-registration state.
            require(claimFrom > 0, "ClaimlessRewards: registration pending");
        }

        uint256 claimUntil = latestCycleTimestamp;
        if (nodeDeregistered != 0) {
            uint256 deregisteredCycle =
                getNextEpochFromTimestamp(nodeDeregistered);

            // A node can only claim up until the next epoch after (or at) its
            // deregistration time. If this is 0, then the node is still
            // in the pending-deregistration state.
            if (deregisteredCycle != 0) {
                claimUntil = deregisteredCycle;
            }
        }

        uint256 lastCumulativeShare =
            cycleCumulativeTokenShares[claimFrom][_token];
        uint256 currentCumulativeShare =
            cycleCumulativeTokenShares[claimUntil][_token];

        return (
            currentCumulativeShare.sub(
                lastCumulativeShare,
                "ClaimlessRewards: error calculating withdrawable balance"
            ),
            claimUntil
        );
    }
}

/// @notice ClaimlessRewards is intended to replace the DarknodePayment
/// contract. It's to main improvements are:
/// 1) no longer requiring nodes to call `claim` each epoch, and
/// 2) allowing for a community fund to earn a proportion of the rewards.
contract ClaimlessRewards is
    Claimable,
    ClaimlessRewardsEvents,
    ClaimlessRewardsState,
    ClaimlessRewardsTokenHandler,
    ClaimlessRewardsAdminHandler,
    ClaimlessRewardsCycleHandler,
    ClaimlessRewardsWithdrawHandler
{
    /// @notice The contract constructor. Starts the current cycle using the
    /// latest epoch.
    ///
    /// @dev The DarknodeRegistry should be set to point to the
    /// ClaimlessRewards contract before the next epoch is called.
    ///
    /// @param _darknodeRegistry The address of the DarknodeRegistry contract
    /// @param _darknodePaymentStore The address of the DarknodePaymentStore
    /// contract. Can be updated by the contract owner.
    /// @param _communityFund The address to which the community fund balances
    /// can be withdrawn to. Can be updated by the contract owner.
    /// @param _communityFundNumerator The portion of the rewards that are paid
    /// to the community fund. Can be updated by the contract owner.
    constructor(
        DarknodeRegistryLogicV1 _darknodeRegistry,
        DarknodePaymentStore _darknodePaymentStore,
        address _communityFund,
        uint256 _communityFundNumerator
    ) public Claimable() {
        Claimable.initialize(msg.sender);

        store = _darknodePaymentStore;
        _updateDarknodeRegistry(_darknodeRegistry);
        _updateCommunityFund(_communityFund);
        _updateCommunityFundNumerator(_communityFundNumerator);

        // Initialize the current cycle to the start of the Registry's epoch.
        (, latestCycleTimestamp) = darknodeRegistry.currentEpoch();
        epochTimestamps.push(latestCycleTimestamp);
    }
}
