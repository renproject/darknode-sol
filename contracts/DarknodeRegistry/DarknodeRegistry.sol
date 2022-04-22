pragma solidity 0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "../RenToken/RenToken.sol";
import "./DarknodeRegistryStore.sol";
import "../Governance/Claimable.sol";
import "../libraries/CanReclaimTokens.sol";
import "./DarknodeRegistryV1.sol";

contract DarknodeRegistryStateV2 {}

/// @notice DarknodeRegistry is responsible for the registration and
/// deregistration of Darknodes.
contract DarknodeRegistryLogicV2 is
    Claimable,
    CanReclaimTokens,
    DarknodeRegistryStateV1,
    DarknodeRegistryStateV2
{
    using SafeMath for uint256;

    /// @notice Emitted when a darknode is registered.
    /// @param _darknodeOperator The owner of the darknode.
    /// @param _darknodeID The ID of the darknode that was registered.
    /// @param _bond The amount of REN that was transferred as bond.
    event LogDarknodeRegistered(
        address indexed _darknodeOperator,
        address indexed _darknodeID,
        uint256 _bond
    );

    /// @notice Emitted when a darknode is deregistered.
    /// @param _darknodeOperator The owner of the darknode.
    /// @param _darknodeID The ID of the darknode that was deregistered.
    event LogDarknodeDeregistered(
        address indexed _darknodeOperator,
        address indexed _darknodeID
    );

    /// @notice Emitted when a refund has been made.
    /// @param _darknodeOperator The owner of the darknode.
    /// @param _darknodeID The ID of the darknode that was refunded.
    /// @param _amount The amount of REN that was refunded.
    event LogDarknodeRefunded(
        address indexed _darknodeOperator,
        address indexed _darknodeID,
        uint256 _amount
    );

    /// @notice Emitted when a recovery has been made.
    /// @param _darknodeOperator The owner of the darknode.
    /// @param _darknodeID The ID of the darknode that was recovered.
    /// @param _bondRecipient The address that received the bond.
    /// @param _submitter The address that called the recover method.
    event LogDarknodeRecovered(
        address indexed _darknodeOperator,
        address indexed _darknodeID,
        address _bondRecipient,
        address indexed _submitter
    );

    /// @notice Emitted when a darknode's bond is slashed.
    /// @param _darknodeOperator The owner of the darknode.
    /// @param _darknodeID The ID of the darknode that was slashed.
    /// @param _challenger The address of the account that submitted the challenge.
    /// @param _percentage The total percentage  of bond slashed.
    event LogDarknodeSlashed(
        address indexed _darknodeOperator,
        address indexed _darknodeID,
        address indexed _challenger,
        uint256 _percentage
    );

    /// @notice Emitted when a new epoch has begun.
    event LogNewEpoch(uint256 indexed epochhash);

    /// @notice Emitted when a constructor parameter has been updated.
    event LogMinimumBondUpdated(
        uint256 _previousMinimumBond,
        uint256 _nextMinimumBond
    );
    event LogMinimumPodSizeUpdated(
        uint256 _previousMinimumPodSize,
        uint256 _nextMinimumPodSize
    );
    event LogMinimumEpochIntervalUpdated(
        uint256 _previousMinimumEpochInterval,
        uint256 _nextMinimumEpochInterval
    );
    event LogSlasherUpdated(
        address indexed _previousSlasher,
        address indexed _nextSlasher
    );
    event LogDarknodePaymentUpdated(
        address indexed _previousDarknodePayment,
        address indexed _nextDarknodePayment
    );

    /// @notice Restrict a function to the owner that registered the darknode.
    modifier onlyDarknodeOperator(address _darknodeID) {
        require(
            store.darknodeOperator(_darknodeID) == msg.sender,
            "DarknodeRegistry: must be darknode owner"
        );
        _;
    }

    /// @notice Restrict a function to unregistered darknodes.
    modifier onlyRefunded(address _darknodeID) {
        require(
            isRefunded(_darknodeID),
            "DarknodeRegistry: must be refunded or never registered"
        );
        _;
    }

    /// @notice Restrict a function to refundable darknodes.
    modifier onlyRefundable(address _darknodeID) {
        require(
            isRefundable(_darknodeID),
            "DarknodeRegistry: must be deregistered for at least one epoch"
        );
        _;
    }

    /// @notice Restrict a function to registered nodes without a pending
    /// deregistration.
    modifier onlyDeregisterable(address _darknodeID) {
        require(
            isDeregisterable(_darknodeID),
            "DarknodeRegistry: must be deregisterable"
        );
        _;
    }

    /// @notice Restrict a function to the Slasher contract.
    modifier onlySlasher() {
        require(
            address(slasher) == msg.sender,
            "DarknodeRegistry: must be slasher"
        );
        _;
    }

    /// @notice Restrict a function to registered and deregistered nodes.
    modifier onlyDarknode(address _darknodeID) {
        require(
            isRegistered(_darknodeID) || isDeregistered(_darknodeID),
            "DarknodeRegistry: invalid darknode"
        );
        _;
    }

    /// @notice The contract constructor.
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _renAddress The address of the RenToken contract.
    /// @param _storeAddress The address of the DarknodeRegistryStore contract.
    /// @param _minimumBond The minimum bond amount that can be submitted by a
    ///        Darknode.
    /// @param _minimumPodSize The minimum size of a Darknode pod.
    /// @param _minimumEpochIntervalSeconds The minimum number of seconds between epochs.
    function initialize(
        string memory _VERSION,
        RenToken _renAddress,
        DarknodeRegistryStore _storeAddress,
        uint256 _minimumBond,
        uint256 _minimumPodSize,
        uint256 _minimumEpochIntervalSeconds,
        uint256 _deregistrationIntervalSeconds
    ) public initializer {
        Claimable.initialize(msg.sender);
        CanReclaimTokens.initialize(msg.sender);
        VERSION = _VERSION;

        store = _storeAddress;
        ren = _renAddress;

        minimumBond = _minimumBond;
        nextMinimumBond = minimumBond;

        minimumPodSize = _minimumPodSize;
        nextMinimumPodSize = minimumPodSize;

        minimumEpochInterval = _minimumEpochIntervalSeconds;
        nextMinimumEpochInterval = minimumEpochInterval;
        deregistrationInterval = _deregistrationIntervalSeconds;

        uint256 epochhash = uint256(blockhash(block.number - 1));
        currentEpoch = Epoch({
            epochhash: epochhash,
            blocktime: block.timestamp
        });
        emit LogNewEpoch(epochhash);
    }

    /// @notice Register a darknode and transfer the bond to this contract.
    /// Before registering, the bond transfer must be approved in the REN
    /// contract. The caller must provide a public encryption key for the
    /// darknode. The darknode will remain pending registration until the next
    /// epoch. Only after this period can the darknode be deregistered. The
    /// caller of this method will be stored as the owner of the darknode.
    ///
    /// @param _darknodeID The darknode ID that will be registered.
    function registerNode(address _darknodeID)
        public
        onlyRefunded(_darknodeID)
    {
        require(
            _darknodeID != address(0),
            "DarknodeRegistry: darknode address cannot be zero"
        );

        // Use the current minimum bond as the darknode's bond and transfer bond to store
        require(
            ren.transferFrom(msg.sender, address(store), minimumBond),
            "DarknodeRegistry: bond transfer failed"
        );

        // Flag this darknode for registration
        store.appendDarknode(
            _darknodeID,
            msg.sender,
            minimumBond,
            "",
            currentEpoch.blocktime.add(minimumEpochInterval),
            0
        );

        numDarknodesNextEpoch = numDarknodesNextEpoch.add(1);

        // Emit an event.
        emit LogDarknodeRegistered(msg.sender, _darknodeID, minimumBond);
    }

    /// @notice An alias for `registerNode` that includes the legacy public key
    /// parameter.
    /// @param _darknodeID The darknode ID that will be registered.
    /// @param _publicKey Deprecated parameter - see `registerNode`.
    function register(address _darknodeID, bytes calldata _publicKey) external {
        return registerNode(_darknodeID);
    }

    /// @notice Register multiple darknodes and transfer the bonds to this contract.
    /// Before registering, the bonds transfer must be approved in the REN contract.
    /// The darknodes will remain pending registration until the next epoch. Only
    /// after this period can the darknodes be deregistered. The caller of this method
    /// will be stored as the owner of each darknode. If one registration fails, all
    /// registrations fail.
    /// @param _darknodeIDs The darknode IDs that will be registered.
    function registerMultiple(address[] calldata _darknodeIDs) external {
        // Save variables in memory to prevent redundant reads from storage
        DarknodeRegistryStore _store = store;
        Epoch memory _currentEpoch = currentEpoch;
        uint256 nextRegisteredAt = _currentEpoch.blocktime.add(
            minimumEpochInterval
        );
        uint256 _minimumBond = minimumBond;

        require(
            ren.transferFrom(
                msg.sender,
                address(_store),
                _minimumBond.mul(_darknodeIDs.length)
            ),
            "DarknodeRegistry: bond transfers failed"
        );

        for (uint256 i = 0; i < _darknodeIDs.length; i++) {
            address darknodeID = _darknodeIDs[i];

            uint256 registeredAt = _store.darknodeRegisteredAt(darknodeID);
            uint256 deregisteredAt = _store.darknodeDeregisteredAt(darknodeID);

            require(
                _isRefunded(registeredAt, deregisteredAt),
                "DarknodeRegistry: must be refunded or never registered"
            );

            require(
                darknodeID != address(0),
                "DarknodeRegistry: darknode address cannot be zero"
            );

            _store.appendDarknode(
                darknodeID,
                msg.sender,
                _minimumBond,
                "",
                nextRegisteredAt,
                0
            );

            emit LogDarknodeRegistered(msg.sender, darknodeID, _minimumBond);
        }

        numDarknodesNextEpoch = numDarknodesNextEpoch.add(_darknodeIDs.length);
    }

    /// @notice Deregister a darknode. The darknode will not be deregistered
    /// until the end of the epoch. After another epoch, the bond can be
    /// refunded by calling the refund method.
    /// @param _darknodeID The darknode ID that will be deregistered. The caller
    ///        of this method must be the owner of this darknode.
    function deregister(address _darknodeID)
        external
        onlyDeregisterable(_darknodeID)
        onlyDarknodeOperator(_darknodeID)
    {
        deregisterDarknode(_darknodeID);
    }

    /// @notice Deregister multiple darknodes. The darknodes will not be
    /// deregistered until the end of the epoch. After another epoch, their
    /// bonds can be refunded by calling the refund or refundMultiple methods.
    /// If one deregistration fails, all deregistrations fail.
    /// @param _darknodeIDs The darknode IDs that will be deregistered. The
    /// caller of this method must be the owner of each darknode.
    function deregisterMultiple(address[] calldata _darknodeIDs) external {
        // Save variables in memory to prevent redundant reads from storage
        DarknodeRegistryStore _store = store;
        Epoch memory _currentEpoch = currentEpoch;
        uint256 _minimumEpochInterval = minimumEpochInterval;

        for (uint256 i = 0; i < _darknodeIDs.length; i++) {
            address darknodeID = _darknodeIDs[i];

            uint256 deregisteredAt = _store.darknodeDeregisteredAt(darknodeID);
            bool registered = isRegisteredInEpoch(
                _store.darknodeRegisteredAt(darknodeID),
                deregisteredAt,
                _currentEpoch
            );

            require(
                _isDeregisterable(registered, deregisteredAt),
                "DarknodeRegistry: must be deregisterable"
            );

            require(
                _store.darknodeOperator(darknodeID) == msg.sender,
                "DarknodeRegistry: must be darknode owner"
            );

            _store.updateDarknodeDeregisteredAt(
                darknodeID,
                _currentEpoch.blocktime.add(_minimumEpochInterval)
            );

            emit LogDarknodeDeregistered(msg.sender, darknodeID);
        }

        numDarknodesNextEpoch = numDarknodesNextEpoch.sub(_darknodeIDs.length);
    }

    /// @notice Progress the epoch if it is possible to do so. This captures
    /// the current timestamp and current blockhash and overrides the current
    /// epoch.
    function epoch() external {
        if (previousEpoch.blocktime == 0) {
            // The first epoch must be called by the owner of the contract
            require(
                msg.sender == owner(),
                "DarknodeRegistry: not authorized to call first epoch"
            );
        }

        // Require that the epoch interval has passed
        require(
            block.timestamp >= currentEpoch.blocktime.add(minimumEpochInterval),
            "DarknodeRegistry: epoch interval has not passed"
        );
        uint256 epochhash = uint256(blockhash(block.number - 1));

        // Update the epoch hash and timestamp
        previousEpoch = currentEpoch;
        currentEpoch = Epoch({
            epochhash: epochhash,
            blocktime: block.timestamp
        });

        // Update the registry information
        numDarknodesPreviousEpoch = numDarknodes;
        numDarknodes = numDarknodesNextEpoch;

        // If any update functions have been called, update the values now
        if (nextMinimumBond != minimumBond) {
            minimumBond = nextMinimumBond;
            emit LogMinimumBondUpdated(minimumBond, nextMinimumBond);
        }
        if (nextMinimumPodSize != minimumPodSize) {
            minimumPodSize = nextMinimumPodSize;
            emit LogMinimumPodSizeUpdated(minimumPodSize, nextMinimumPodSize);
        }
        if (nextMinimumEpochInterval != minimumEpochInterval) {
            minimumEpochInterval = nextMinimumEpochInterval;
            emit LogMinimumEpochIntervalUpdated(
                minimumEpochInterval,
                nextMinimumEpochInterval
            );
        }
        if (nextSlasher != slasher) {
            slasher = nextSlasher;
            emit LogSlasherUpdated(address(slasher), address(nextSlasher));
        }

        // Emit an event
        emit LogNewEpoch(epochhash);
    }

    /// @notice Allows the contract owner to initiate an ownership transfer of
    /// the DarknodeRegistryStore.
    /// @param _newOwner The address to transfer the ownership to.
    function transferStoreOwnership(DarknodeRegistryLogicV2 _newOwner)
        external
        onlyOwner
    {
        store.transferOwnership(address(_newOwner));
        _newOwner.claimStoreOwnership();
    }

    /// @notice Claims ownership of the store passed in to the constructor.
    /// `transferStoreOwnership` must have previously been called when
    /// transferring from another Darknode Registry.
    function claimStoreOwnership() external {
        store.claimOwnership();

        // Sync state with new store.
        // Note: numDarknodesPreviousEpoch is set to 0 for a newly deployed DNR.
        (
            numDarknodesPreviousEpoch,
            numDarknodes,
            numDarknodesNextEpoch
        ) = getDarknodeCountFromEpochs();
    }

    /// @notice Allows the contract owner to update the minimum bond.
    /// @param _nextMinimumBond The minimum bond amount that can be submitted by
    ///        a darknode.
    function updateMinimumBond(uint256 _nextMinimumBond) external onlyOwner {
        // Will be updated next epoch
        nextMinimumBond = _nextMinimumBond;
    }

    /// @notice Allows the contract owner to update the minimum pod size.
    /// @param _nextMinimumPodSize The minimum size of a pod.
    function updateMinimumPodSize(uint256 _nextMinimumPodSize)
        external
        onlyOwner
    {
        // Will be updated next epoch
        nextMinimumPodSize = _nextMinimumPodSize;
    }

    /// @notice Allows the contract owner to update the minimum epoch interval.
    /// @param _nextMinimumEpochInterval The minimum number of blocks between epochs.
    function updateMinimumEpochInterval(uint256 _nextMinimumEpochInterval)
        external
        onlyOwner
    {
        // Will be updated next epoch
        nextMinimumEpochInterval = _nextMinimumEpochInterval;
    }

    /// @notice Allow the contract owner to update the DarknodeSlasher contract
    /// address.
    /// @param _slasher The new slasher address.
    function updateSlasher(IDarknodeSlasher _slasher) external onlyOwner {
        nextSlasher = _slasher;
    }

    /// @notice Allow the DarknodeSlasher contract to slash a portion of darknode's
    ///         bond and deregister it.
    /// @param _guilty The guilty prover whose bond is being slashed.
    /// @param _challenger The challenger who should receive a portion of the bond as reward.
    /// @param _percentage The total percentage  of bond to be slashed.
    function slash(
        address _guilty,
        address _challenger,
        uint256 _percentage
    ) external onlySlasher onlyDarknode(_guilty) {
        require(_percentage <= 100, "DarknodeRegistry: invalid percent");

        // If the darknode has not been deregistered then deregister it
        if (isDeregisterable(_guilty)) {
            deregisterDarknode(_guilty);
        }

        uint256 totalBond = store.darknodeBond(_guilty);
        uint256 penalty = totalBond.div(100).mul(_percentage);
        uint256 challengerReward = penalty.div(2);
        uint256 slasherPortion = penalty.sub(challengerReward);
        if (challengerReward > 0) {
            // Slash the bond of the failed prover
            store.updateDarknodeBond(_guilty, totalBond.sub(penalty));

            // Forward the remaining amount to be handled by the slasher.
            require(
                ren.transfer(msg.sender, slasherPortion),
                "DarknodeRegistry: reward transfer to slasher failed"
            );
            require(
                ren.transfer(_challenger, challengerReward),
                "DarknodeRegistry: reward transfer to challenger failed"
            );
        }

        emit LogDarknodeSlashed(
            store.darknodeOperator(_guilty),
            _guilty,
            _challenger,
            _percentage
        );
    }

    /// @notice Refund the bond of a deregistered darknode. This will make the
    /// darknode available for registration again.
    ///
    /// @param _darknodeID The darknode ID that will be refunded.
    function refund(address _darknodeID)
        external
        onlyRefundable(_darknodeID)
        onlyDarknodeOperator(_darknodeID)
    {
        // Remember the bond amount
        uint256 amount = store.darknodeBond(_darknodeID);

        // Erase the darknode from the registry
        store.removeDarknode(_darknodeID);

        // Refund the operator by transferring REN
        require(
            ren.transfer(msg.sender, amount),
            "DarknodeRegistry: bond transfer failed"
        );

        // Emit an event.
        emit LogDarknodeRefunded(msg.sender, _darknodeID, amount);
    }

    /// @notice A permissioned method for refunding a darknode without the usual
    /// delay. The operator must provide a signature of the darknode ID and the
    /// bond recipient, but the call must come from the contract's owner. The
    /// main use case is for when an operator's keys have been compromised,
    /// allowing for the bonds to be recovered by the operator through the
    /// GatewayRegistry's governance. It is expected that this process would
    /// happen towards the end of the darknode's deregistered period, so that
    /// a malicious operator can't use this to quickly exit their stake after
    /// attempting an attack on the network. It's also expected that the
    /// operator will not re-register the same darknode again.
    function recover(
        address _darknodeID,
        address _bondRecipient,
        bytes calldata _signature
    ) external onlyOwner {
        require(
            isRefundable(_darknodeID) || isDeregistered(_darknodeID),
            "DarknodeRegistry: must be deregistered"
        );

        address darknodeOperator = store.darknodeOperator(_darknodeID);

        require(
            ECDSA.recover(
                keccak256(
                    abi.encodePacked(
                        "\x19Ethereum Signed Message:\n64",
                        "DarknodeRegistry.recover",
                        _darknodeID,
                        _bondRecipient
                    )
                ),
                _signature
            ) == darknodeOperator,
            "DarknodeRegistry: invalid signature"
        );

        // Remember the bond amount
        uint256 amount = store.darknodeBond(_darknodeID);

        // Erase the darknode from the registry
        store.removeDarknode(_darknodeID);

        // Refund the operator by transferring REN
        require(
            ren.transfer(_bondRecipient, amount),
            "DarknodeRegistry: bond transfer failed"
        );

        // Emit an event.
        emit LogDarknodeRefunded(darknodeOperator, _darknodeID, amount);
        emit LogDarknodeRecovered(
            darknodeOperator,
            _darknodeID,
            _bondRecipient,
            msg.sender
        );
    }

    /// @notice Refund the bonds of multiple deregistered darknodes. This will
    /// make the darknodes available for registration again. If one refund fails,
    /// all refunds fail.
    /// @param _darknodeIDs The darknode IDs that will be refunded.
    function refundMultiple(address[] calldata _darknodeIDs) external {
        // Save variables in memory to prevent redundant reads from storage
        DarknodeRegistryStore _store = store;
        Epoch memory _currentEpoch = currentEpoch;
        Epoch memory _previousEpoch = previousEpoch;
        uint256 _deregistrationInterval = deregistrationInterval;

        // The sum of bonds to refund
        uint256 sum;

        for (uint256 i = 0; i < _darknodeIDs.length; i++) {
            address darknodeID = _darknodeIDs[i];

            uint256 deregisteredAt = _store.darknodeDeregisteredAt(darknodeID);
            bool deregistered = _isDeregistered(deregisteredAt, _currentEpoch);

            require(
                _isRefundable(
                    deregistered,
                    deregisteredAt,
                    _previousEpoch,
                    _deregistrationInterval
                ),
                "DarknodeRegistry: must be deregistered for at least one epoch"
            );

            require(
                _store.darknodeOperator(darknodeID) == msg.sender,
                "DarknodeRegistry: must be darknode owner"
            );

            // Remember the bond amount
            uint256 amount = _store.darknodeBond(darknodeID);

            // Erase the darknode from the registry
            _store.removeDarknode(darknodeID);

            // Emit an event
            emit LogDarknodeRefunded(msg.sender, darknodeID, amount);

            // Increment the sum of bonds to be transferred
            sum = sum.add(amount);
        }

        // Transfer all bonds together
        require(
            ren.transfer(msg.sender, sum),
            "DarknodeRegistry: bond transfers failed"
        );
    }

    /// @notice Retrieves the address of the account that registered a darknode.
    /// @param _darknodeID The ID of the darknode to retrieve the owner for.
    function getDarknodeOperator(address _darknodeID)
        external
        view
        returns (address payable)
    {
        return store.darknodeOperator(_darknodeID);
    }

    /// @notice Retrieves the bond amount of a darknode in 10^-18 REN.
    /// @param _darknodeID The ID of the darknode to retrieve the bond for.
    function getDarknodeBond(address _darknodeID)
        external
        view
        returns (uint256)
    {
        return store.darknodeBond(_darknodeID);
    }

    /// @notice Retrieves the encryption public key of the darknode.
    /// @param _darknodeID The ID of the darknode to retrieve the public key for.
    function getDarknodePublicKey(address _darknodeID)
        external
        view
        returns (bytes memory)
    {
        return store.darknodePublicKey(_darknodeID);
    }

    /// @notice Retrieves a list of darknodes which are registered for the
    /// current epoch.
    /// @param _start A darknode ID used as an offset for the list. If _start is
    ///        0x0, the first dark node will be used. _start won't be
    ///        included it is not registered for the epoch.
    /// @param _count The number of darknodes to retrieve starting from _start.
    ///        If _count is 0, all of the darknodes from _start are
    ///        retrieved. If _count is more than the remaining number of
    ///        registered darknodes, the rest of the list will contain
    ///        0x0s.
    function getDarknodes(address _start, uint256 _count)
        external
        view
        returns (address[] memory)
    {
        uint256 count = _count;
        if (count == 0) {
            count = numDarknodes;
        }
        return getDarknodesFromEpochs(_start, count, false);
    }

    /// @notice Retrieves a list of darknodes which were registered for the
    /// previous epoch. See `getDarknodes` for the parameter documentation.
    function getPreviousDarknodes(address _start, uint256 _count)
        external
        view
        returns (address[] memory)
    {
        uint256 count = _count;
        if (count == 0) {
            count = numDarknodesPreviousEpoch;
        }
        return getDarknodesFromEpochs(_start, count, true);
    }

    /// @notice Returns whether a darknode is scheduled to become registered
    /// at next epoch.
    /// @param _darknodeID The ID of the darknode to return.
    function isPendingRegistration(address _darknodeID)
        public
        view
        returns (bool)
    {
        uint256 registeredAt = store.darknodeRegisteredAt(_darknodeID);
        return registeredAt != 0 && registeredAt > currentEpoch.blocktime;
    }

    /// @notice Returns if a darknode is in the pending deregistered state. In
    /// this state a darknode is still considered registered.
    function isPendingDeregistration(address _darknodeID)
        public
        view
        returns (bool)
    {
        uint256 deregisteredAt = store.darknodeDeregisteredAt(_darknodeID);
        return deregisteredAt != 0 && deregisteredAt > currentEpoch.blocktime;
    }

    /// @notice Returns if a darknode is in the deregistered state.
    function isDeregistered(address _darknodeID) public view returns (bool) {
        uint256 deregisteredAt = store.darknodeDeregisteredAt(_darknodeID);
        return _isDeregistered(deregisteredAt, currentEpoch);
    }

    /// @notice Returns if a darknode can be deregistered. This is true if the
    /// darknodes is in the registered state and has not attempted to
    /// deregister yet.
    function isDeregisterable(address _darknodeID) public view returns (bool) {
        DarknodeRegistryStore _store = store;
        uint256 deregisteredAt = _store.darknodeDeregisteredAt(_darknodeID);
        bool registered = isRegisteredInEpoch(
            _store.darknodeRegisteredAt(_darknodeID),
            deregisteredAt,
            currentEpoch
        );
        return _isDeregisterable(registered, deregisteredAt);
    }

    /// @notice Returns if a darknode is in the refunded state. This is true
    /// for darknodes that have never been registered, or darknodes that have
    /// been deregistered and refunded.
    function isRefunded(address _darknodeID) public view returns (bool) {
        DarknodeRegistryStore _store = store;
        uint256 registeredAt = _store.darknodeRegisteredAt(_darknodeID);
        uint256 deregisteredAt = _store.darknodeDeregisteredAt(_darknodeID);
        return _isRefunded(registeredAt, deregisteredAt);
    }

    /// @notice Returns if a darknode is refundable. This is true for darknodes
    /// that have been in the deregistered state for one full epoch.
    function isRefundable(address _darknodeID) public view returns (bool) {
        uint256 deregisteredAt = store.darknodeDeregisteredAt(_darknodeID);
        bool deregistered = _isDeregistered(deregisteredAt, currentEpoch);

        return
            _isRefundable(
                deregistered,
                deregisteredAt,
                previousEpoch,
                deregistrationInterval
            );
    }

    /// @notice Returns the registration time of a given darknode.
    function darknodeRegisteredAt(address darknodeID)
        external
        view
        returns (uint256)
    {
        return store.darknodeRegisteredAt(darknodeID);
    }

    /// @notice Returns the deregistration time of a given darknode.
    function darknodeDeregisteredAt(address darknodeID)
        external
        view
        returns (uint256)
    {
        return store.darknodeDeregisteredAt(darknodeID);
    }

    /// @notice Returns if a darknode is in the registered state.
    function isRegistered(address _darknodeID) public view returns (bool) {
        DarknodeRegistryStore _store = store;
        uint256 registeredAt = _store.darknodeRegisteredAt(_darknodeID);
        uint256 deregisteredAt = _store.darknodeDeregisteredAt(_darknodeID);
        return isRegisteredInEpoch(registeredAt, deregisteredAt, currentEpoch);
    }

    /// @notice Returns if a darknode was in the registered state last epoch.
    function isRegisteredInPreviousEpoch(address _darknodeID)
        public
        view
        returns (bool)
    {
        DarknodeRegistryStore _store = store;
        uint256 registeredAt = _store.darknodeRegisteredAt(_darknodeID);
        uint256 deregisteredAt = _store.darknodeDeregisteredAt(_darknodeID);
        return isRegisteredInEpoch(registeredAt, deregisteredAt, previousEpoch);
    }

    function getOperatorDarknodes(address _operator)
        public
        view
        returns (address[] memory)
    {
        address[] memory nodesPadded = new address[](numDarknodes);

        address[] memory allNodes = getDarknodesFromEpochs(
            address(0),
            numDarknodes,
            false
        );

        uint256 j = 0;
        for (uint256 i = 0; i < allNodes.length; i++) {
            if (store.darknodeOperator(allNodes[i]) == _operator) {
                nodesPadded[j] = (allNodes[i]);
                j++;
            }
        }

        address[] memory nodes = new address[](j);
        for (uint256 i = 0; i < j; i++) {
            nodes[i] = nodesPadded[i];
        }

        return nodes;
    }

    /// @notice Returns if a darknode was in the registered state for a given
    /// epoch.
    /// @param _epoch One of currentEpoch, previousEpoch.
    function isRegisteredInEpoch(
        uint256 _registeredAt,
        uint256 _deregisteredAt,
        Epoch memory _epoch
    ) private pure returns (bool) {
        bool registered = _registeredAt != 0 &&
            _registeredAt <= _epoch.blocktime;
        bool notDeregistered = _deregisteredAt == 0 ||
            _deregisteredAt > _epoch.blocktime;
        // The Darknode has been registered and has not yet been deregistered,
        // although it might be pending deregistration
        return registered && notDeregistered;
    }

    /// Private function called by `isDeregistered`, `isRefundable`, and `refundMultiple`.
    function _isDeregistered(
        uint256 _deregisteredAt,
        Epoch memory _currentEpoch
    ) private pure returns (bool) {
        return
            _deregisteredAt != 0 && _deregisteredAt <= _currentEpoch.blocktime;
    }

    /// Private function called by `isDeregisterable` and `deregisterMultiple`.
    function _isDeregisterable(bool _registered, uint256 _deregisteredAt)
        private
        pure
        returns (bool)
    {
        // The Darknode is currently in the registered state and has not been
        // transitioned to the pending deregistration, or deregistered, state
        return _registered && _deregisteredAt == 0;
    }

    /// Private function called by `isRefunded` and `registerMultiple`.
    function _isRefunded(uint256 registeredAt, uint256 deregisteredAt)
        private
        pure
        returns (bool)
    {
        return registeredAt == 0 && deregisteredAt == 0;
    }

    /// Private function called by `isRefundable` and `refundMultiple`.
    function _isRefundable(
        bool _deregistered,
        uint256 _deregisteredAt,
        Epoch memory _previousEpoch,
        uint256 _deregistrationInterval
    ) private pure returns (bool) {
        return
            _deregistered &&
            _deregisteredAt <=
            (_previousEpoch.blocktime - _deregistrationInterval);
    }

    /// @notice Returns a list of darknodes registered for either the current
    /// or the previous epoch. See `getDarknodes` for documentation on the
    /// parameters `_start` and `_count`.
    /// @param _usePreviousEpoch If true, use the previous epoch, otherwise use
    ///        the current epoch.
    function getDarknodesFromEpochs(
        address _start,
        uint256 _count,
        bool _usePreviousEpoch
    ) private view returns (address[] memory) {
        uint256 count = _count;
        if (count == 0) {
            count = numDarknodes;
        }

        address[] memory nodes = new address[](count);

        // Begin with the first node in the list
        uint256 n = 0;
        address next = _start;
        if (next == address(0)) {
            next = store.begin();
        }

        // Iterate until all registered Darknodes have been collected
        while (n < count) {
            if (next == address(0)) {
                break;
            }
            // Only include Darknodes that are currently registered
            bool includeNext;
            if (_usePreviousEpoch) {
                includeNext = isRegisteredInPreviousEpoch(next);
            } else {
                includeNext = isRegistered(next);
            }
            if (!includeNext) {
                next = store.next(next);
                continue;
            }
            nodes[n] = next;
            next = store.next(next);
            n += 1;
        }
        return nodes;
    }

    /// Private function called by `deregister` and `slash`
    function deregisterDarknode(address _darknodeID) private {
        address darknodeOperator = store.darknodeOperator(_darknodeID);

        // Flag the darknode for deregistration
        store.updateDarknodeDeregisteredAt(
            _darknodeID,
            currentEpoch.blocktime.add(minimumEpochInterval)
        );
        numDarknodesNextEpoch = numDarknodesNextEpoch.sub(1);

        // Emit an event
        emit LogDarknodeDeregistered(darknodeOperator, _darknodeID);
    }

    function getDarknodeCountFromEpochs()
        private
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        // Begin with the first node in the list
        uint256 nPreviousEpoch = 0;
        uint256 nCurrentEpoch = 0;
        uint256 nNextEpoch = 0;
        address next = store.begin();

        // Iterate until all registered Darknodes have been collected
        while (true) {
            // End of darknode list.
            if (next == address(0)) {
                break;
            }

            if (isRegisteredInPreviousEpoch(next)) {
                nPreviousEpoch += 1;
            }

            if (isRegistered(next)) {
                nCurrentEpoch += 1;
            }

            // Darknode is registered and has not deregistered, or is pending
            // becoming registered.
            if (
                ((isRegistered(next) && !isPendingDeregistration(next)) ||
                    isPendingRegistration(next))
            ) {
                nNextEpoch += 1;
            }
            next = store.next(next);
        }
        return (nPreviousEpoch, nCurrentEpoch, nNextEpoch);
    }
}

/* solium-disable-next-line no-empty-blocks */
contract DarknodeRegistryProxy is InitializableAdminUpgradeabilityProxy {

}
