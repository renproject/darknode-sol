pragma solidity 0.5.16;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";

import "../Governance/Claimable.sol";
import "../libraries/String.sol";
import "../libraries/CanReclaimTokens.sol";
import "../DarknodeRegistry/DarknodeRegistry.sol";

contract DarknodeRewardsStateV1 {
    /// @notice The special address for Ether.
    address
        public constant ETHEREUM = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    DarknodeRegistryLogicV1 public darknodeRegistry; // Passed in as a constructor parameter.

    /// @notice The address that can call changeCycle()
    //          This defaults to the owner but should be changed to the DarknodeRegistry.
    address public cycleChanger;

    /// @notice Mapping from token -> amount.
    ///         The amount of rewards allocated for all darknodes to claim into
    ///         their account.
    mapping(address => uint256) public unclaimedRewards;

    /// @notice Mapping from token -> amount.
    ///         The total amount of tokens allocated for each darknode in the
    ///         previous cycle.
    mapping(address => uint256) public tokenLastRewardShare;

    /// @notice Mapping from token -> amount.
    ///         The total amount of tokens allocated for each darknode.
    mapping(address => uint256) public tokenRewardShareSum;

    /// @notice Mapping of token -> lockedAmount.
    mapping(address => uint256) public lockedBalances;

    /// @notice Mapping from darknode -> token -> amount.
    ///         The last snapshot the darknode
    mapping(address => mapping(address => uint256)) public darknodeLastClaimed;

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

    /// @notice The current cycle payout percentage to the darknodes.
    uint256 public currentCyclePayoutPercent;

    /// @notice The staged payout percentage to the darknodes per cycle.
    uint256 public nextCyclePayoutPercent;
}

contract DarknodeRewardsLogicV1_TokenRegistry is
    Ownable,
    DarknodeRewardsStateV1
{
    using SafeMath for uint256;

    /// @notice Emitted when a new token is registered.
    /// @param _token The token that was registered.
    event LogTokenRegistered(address indexed _token);

    /// @notice Emitted when a token is deregistered.
    /// @param _token The token that was deregistered.
    event LogTokenDeregistered(address indexed _token);

    /// @notice Adds tokens to be payable. Registration is pending until next
    ///         cycle.
    ///
    /// @param _token The address of the token to be registered.
    function registerToken(address _token) external onlyOwner {
        require(
            registeredTokenIndex[_token] == 0,
            "DarknodePayment: token already registered"
        );
        require(
            !tokenPendingRegistration(_token),
            "DarknodePayment: token already pending registration"
        );
        pendingTokens.push(_token);
    }

    function tokenPendingRegistration(address _token)
        public
        view
        returns (bool)
    {
        uint256 arrayLength = pendingTokens.length;
        for (uint256 i = 0; i < arrayLength; i++) {
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
        require(
            registeredTokenIndex[_token] > 0,
            "DarknodePayment: token not registered"
        );
        _deregisterToken(_token);
    }

    /// @notice Updates the list of registeredTokens adding tokens that are to be registered.
    ///         The list of tokens that are pending registration are emptied afterwards.
    function _updateTokenList() internal {
        // Register tokens
        uint256 arrayLength = pendingTokens.length;
        for (uint256 i = 0; i < arrayLength; i++) {
            address token = pendingTokens[i];
            registeredTokens.push(token);
            registeredTokenIndex[token] = registeredTokens.length;
            emit LogTokenRegistered(token);
        }
        pendingTokens.length = 0;
    }

    /// @notice Deregisters a token, removing it from the list of
    ///         registeredTokens.
    ///
    /// @param _token The address of the token to deregister.
    function _deregisterToken(address _token) private {
        address lastToken = registeredTokens[registeredTokens.length.sub(
            1,
            "DarknodePayment: no tokens registered"
        )];
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
}

contract DarknodeRewardsLogicV1_CycleTracker is
    Ownable,
    DarknodeRewardsStateV1,
    DarknodeRewardsLogicV1_TokenRegistry
{
    using SafeMath for uint256;

    /// @notice Emitted when the CycleChanger address changes.
    /// @param _newCycleChanger The new CycleChanger.
    /// @param _oldCycleChanger The old CycleChanger.
    event LogCycleChangerChanged(
        address indexed _newCycleChanger,
        address indexed _oldCycleChanger
    );

    /// @notice Restrict a function to be called by cycleChanger.
    modifier onlyCycleChanger {
        require(
            msg.sender == cycleChanger,
            "DarknodePayment: not cycle changer"
        );
        _;
    }

    /// @notice Updates the CycleChanger contract address.
    ///
    /// @param _addr The new CycleChanger contract address.
    function updateCycleChanger(address _addr) external onlyOwner {
        require(
            _addr != address(0),
            "DarknodePayment: invalid contract address"
        );
        emit LogCycleChangerChanged(_addr, cycleChanger);
        cycleChanger = _addr;
    }

    /// @notice Get the total balance of the contract for a particular token.
    ///
    /// @param _token The token to check balance of.
    /// @return The total balance of the contract.
    function totalBalance(address _token) public view returns (uint256) {
        if (_token == ETHEREUM) {
            return address(this).balance;
        } else {
            return ERC20(_token).balanceOf(address(this));
        }
    }

    /// @notice Get the available balance of the contract for a particular token
    ///         This is the free amount which has not yet been allocated to
    ///         darknodes.
    ///
    /// @param _token The token to check balance of.
    /// @return The available balance of the contract.
    function availableBalance(address _token) public view returns (uint256) {
        return
            totalBalance(_token).sub(
                lockedBalances[_token],
                "DarknodeRewards: locked balance exceed total balance"
            );
    }

    /// @notice Changes the current cycle.
    function changeCycle() external onlyCycleChanger returns (uint256) {
        // Snapshot balances for the past cycle.
        uint256 arrayLength = registeredTokens.length;
        for (uint256 i = 0; i < arrayLength; i++) {
            _snapshotBalance(registeredTokens[i]);
        }

        currentCyclePayoutPercent = nextCyclePayoutPercent;

        // Update the list of registeredTokens.
        DarknodeRewardsLogicV1_TokenRegistry._updateTokenList();
    }

    /// @notice Snapshots the current balance of the tokens, for all registered
    ///         tokens.
    ///
    /// @param _token The address the token to snapshot.
    function _snapshotBalance(address _token) private {
        uint256 shareCount = darknodeRegistry.numDarknodesPreviousEpoch();
        if (shareCount == 0) {
            unclaimedRewards[_token] = 0;
            tokenLastRewardShare[_token] = 0;
        } else {
            // Lock up the current balance for darknode reward allocation
            uint256 total = availableBalance(_token);
            unclaimedRewards[_token] = total.div(100).mul(
                currentCyclePayoutPercent
            );
            tokenLastRewardShare[_token] = unclaimedRewards[_token].div(
                shareCount
            );
        }
    }
}

contract DarknodeRewardsLogicV1_Withdraws is Ownable, DarknodeRewardsStateV1 {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    /// @notice Emitted when the DarknodeRegistry is updated.
    /// @param _previousDarknodeRegistry The address of the old registry.
    /// @param _nextDarknodeRegistry The address of the new registry.
    event LogDarknodeRegistryUpdated(
        DarknodeRegistryLogicV1 indexed _previousDarknodeRegistry,
        DarknodeRegistryLogicV1 indexed _nextDarknodeRegistry
    );

    /// @notice Emitted when a darknode claims their share of reward.
    /// @param _darknode The darknode which claimed.
    /// @param _cycle The cycle that the darknode claimed for.
    event LogDarknodeClaim(address indexed _darknode, uint256 _cycle);

    /// @notice Emitted when a darknode calls withdraw.
    /// @param _darknodeOperator The address of the darknode's operator.
    /// @param _darknodeID The address of the darknode which withdrew.
    /// @param _value The amount of DAI withdrawn.
    /// @param _token The address of the token that was withdrawn.
    event LogDarknodeWithdrew(
        address indexed _darknodeOperator,
        address indexed _darknodeID,
        address indexed _token,
        uint256 _value
    );

    /// @notice Allows the contract owner to update the address of the
    /// darknode registry contract.
    /// @param _darknodeRegistry The address of the Darknode Registry
    /// contract.
    function updateDarknodeRegistry(DarknodeRegistryLogicV1 _darknodeRegistry)
        external
        onlyOwner
    {
        require(
            address(_darknodeRegistry) != address(0x0),
            "DarknodePayment: invalid Darknode Registry address"
        );
        DarknodeRegistryLogicV1 previousDarknodeRegistry = darknodeRegistry;
        darknodeRegistry = _darknodeRegistry;
        emit LogDarknodeRegistryUpdated(
            previousDarknodeRegistry,
            darknodeRegistry
        );
    }

    /// @notice Transfers an amount out of balance to a specified address.
    ///
    /// @param _token Which token to transfer.
    /// @param _amount The amount to transfer.
    /// @param _recipient The address to withdraw it to.
    function transfer(
        address _token,
        uint256 _amount,
        address payable _recipient
    ) internal {
        if (_token == ETHEREUM) {
            _recipient.transfer(_amount);
        } else {
            ERC20(_token).safeTransfer(_recipient, _amount);
        }
    }

    /// @notice Transfers the funds allocated to the darknode to the darknode
    ///         owner.
    ///
    /// @param _darknode The address of the darknode.
    /// @param _token Which token to transfer.
    function withdraw(address _darknode, address _token) public {
        address payable darknodeOperator = darknodeRegistry.getDarknodeOperator(
            _darknode
        );
        require(
            darknodeOperator != address(0x0),
            "DarknodePayment: invalid darknode owner"
        );

        //
        if (darknodeLastClaimed[_darknode][_token] == 0) {
            darknodeLastClaimed[_darknode][_token] = tokenRewardShareSum[_token];
        }

        uint256 amount = tokenRewardShareSum[_token].sub(
            darknodeLastClaimed[_darknode][_token]
        );

        darknodeLastClaimed[_darknode][_token] = tokenRewardShareSum[_token];

        // Skip if amount is zero.
        if (amount > 0) {
            lockedBalances[_token] = lockedBalances[_token].sub(
                amount,
                "DarknodeRewards: insufficient token balance for transfer"
            );

            transfer(_token, amount, darknodeOperator);
            emit LogDarknodeWithdrew(
                darknodeOperator,
                _darknode,
                _token,
                amount
            );
        }
    }

    function withdrawMultiple(
        address[] calldata _darknodes,
        address[] calldata _tokens
    ) external {
        for (uint256 i = 0; i < _darknodes.length; i++) {
            for (uint256 j = 0; j < _tokens.length; j++) {
                withdraw(_darknodes[i], _tokens[j]);
            }
        }
    }
}

/// @notice Gateway handles verifying mint and burn requests. A mintAuthority
/// approves new assets to be minted by providing a digital signature. An owner
/// of an asset can request for it to be burnt.
contract DarknodeRewardsLogicV1 is
    Initializable,
    Claimable,
    DarknodeRewardsStateV1,
    DarknodeRewardsLogicV1_TokenRegistry,
    DarknodeRewardsLogicV1_CycleTracker,
    DarknodeRewardsLogicV1_Withdraws
{
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    /// @notice Emitted when someone pays the DarknodePayment contract.
    /// @param _payer The darknode which claimed.
    /// @param _amount The cycle that the darknode claimed for.
    /// @param _token The address of the token that was transferred.
    event LogPaymentReceived(
        address indexed _payer,
        address indexed _token,
        uint256 _amount
    );

    /// @notice Emitted when the payout percent changes.
    /// @param _newPercent The new percent.
    /// @param _oldPercent The old percent.
    event LogPayoutPercentChanged(uint256 _newPercent, uint256 _oldPercent);

    function initialize(
        DarknodeRegistryLogicV1 _darknodeRegistry,
        uint256 _cyclePayoutPercent
    ) public initializer {
        Claimable.initialize(msg.sender);
        darknodeRegistry = _darknodeRegistry;

        nextCyclePayoutPercent = _cyclePayoutPercent;
        cycleChanger = msg.sender;
        currentCyclePayoutPercent = nextCyclePayoutPercent;
    }

    /// @notice Forward all payments to the DarknodePaymentStore.
    function() external payable {
        require(
            registeredTokenIndex[ETHEREUM] > 0,
            "DarknodePayment: token not registered"
        );
        emit LogPaymentReceived(msg.sender, ETHEREUM, msg.value);
    }
}

/* solium-disable-next-line no-empty-blocks */
contract DarknodeRewardsProxy is InitializableAdminUpgradeabilityProxy {

}
