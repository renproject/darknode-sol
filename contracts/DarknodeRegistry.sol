pragma solidity ^0.4.24;

import "zos-lib/contracts/migrations/Migratable.sol";

import "openzeppelin-zos/contracts/ownership/Ownable.sol";
import "openzeppelin-zos/contracts/math/SafeMath.sol";

import "./RepublicToken.sol";
import "./libraries/LinkedList.sol";

/// @notice DarknodeRegistry is responsible for the registration and
/// deregistration of Darknodes.
contract DarknodeRegistry is Migratable, Ownable {

    bool internal _initialized;
    using SafeMath for uint256;

    string public VERSION; // Passed in as a constructor parameter.

    /// @notice Darknode pods are shuffled after a fixed number of blocks.
    /// An Epoch stores an epoch hash used as an (insecure) RNG seed, and the
    /// blocknumber which restricts when the next epoch can be called.
    struct Epoch {
        uint256 epochhash;
        uint256 blocknumber;
    }

    /// @notice Darknodes are stored in the darknode struct. The owner is the
    /// address that registered the darknode, the bond is the amount of REN that
    /// was transferred during registration, and the public key is the
    /// encryption key that should be used when sending sensitive information to
    /// the darknode.
    struct Darknode {
        // The owner of a Darknode is the address that called the register
        // function. The owner is the only address that is allowed to
        // deregister the Darknode, unless the Darknode is slashed for
        // malicious behavior.
        address owner;

        // The bond is the amount of REN submitted as a bond by the Darknode.
        // This amount is reduced when the Darknode is slashed for malicious
        // behavior.
        uint256 bond;

        // The block number at which the Darknode is considered registered.
        uint256 registeredAt;

        // The block number at which the Darknode is considered deregistered.
        uint256 deregisteredAt;

        // The public key used by this Darknode for encrypting sensitive data
        // off chain. It is assumed that the Darknode has access to the
        // respective private key, and that there is an agreement on the format
        // of the public key.
        bytes publicKey;
    }

    /// Republic ERC20 token contract used to transfer bonds.
    RepublicToken public ren;

    mapping(address => Darknode) private darknodeRegistry;
    LinkedList.List private darknodes;

    uint256 public numDarknodes;
    uint256 public numDarknodesNextEpoch;
    uint256 public numDarknodesPreviousEpoch;

    /// Previous epoch setup
    uint256 public previousMinimumBond;
    uint256 public previousMinimumPodSize;
    uint256 public previousMinimumEpochInterval;
    uint256 public previousSlasher;

    /// Variables used to parameterize behavior.
    uint256 public minimumBond;
    uint256 public minimumPodSize;
    uint256 public minimumEpochInterval;
    address public slasher;

    /// When one of the above variables is modified, it is only updated when the
    /// next epoch is called. These variables store the values for the next epoch.
    uint256 public nextMinimumBond;
    uint256 public nextMinimumPodSize;
    uint256 public nextMinimumEpochInterval;
    address public nextSlasher;

    /// The current and previous epoch
    Epoch public currentEpoch;
    Epoch public previousEpoch;

    /// @notice Emitted when a darknode is registered.
    /// @param _darknodeID The darknode ID that was registered.
    /// @param _bond The amount of REN that was transferred as bond.
    event LogDarknodeRegistered(address _darknodeID, uint256 _bond);

    /// @notice Emitted when a darknode is deregistered.
    /// @param _darknodeID The darknode ID that was deregistered.
    event LogDarknodeDeregistered(address _darknodeID);

    /// @notice Emitted when a refund has been made.
    /// @param _owner The address that was refunded.
    /// @param _amount The amount of REN that was refunded.
    event LogDarknodeOwnerRefunded(address _owner, uint256 _amount);

    /// @notice Emitted when a new epoch has begun.
    event LogNewEpoch();

    /// @notice Emitted when a constructor parameter has been updated.
    event LogMinimumBondUpdated(uint256 previousMinimumBond, uint256 nextMinimumBond);
    event LogMinimumPodSizeUpdated(uint256 previousMinimumPodSize, uint256 nextMinimumPodSize);
    event LogMinimumEpochIntervalUpdated(uint256 previousMinimumEpochInterval, uint256 nextMinimumEpochInterval);
    event LogSlasherUpdated(address previousSlasher, address nextSlasher);

    /// @notice Only allow the owner that registered the darknode to pass.
    modifier onlyDarknodeOwner(address _darknodeID) {
        require(_darknodeOwner(_darknodeID) == msg.sender, "must be darknode owner");
        _;
    }

    /// @notice Only allow unregistered darknodes.
    modifier onlyRefunded(address _darknodeID) {
        require(isRefunded(_darknodeID), "must be refunded or never registered");
        _;
    }

    /// @notice Only allow refundable darknodes.
    modifier onlyRefundable(address _darknodeID) {
        require(isRefundable(_darknodeID), "must be deregistered for at least one epoch");
        _;
    }

    /// @notice Only allowed registered nodes without a pending deregistration to
    /// deregister
    modifier onlyDeregisterable(address _darknodeID) {
        require(isDeregisterable(_darknodeID), "must be deregisterable");
        _;
    }

    /// @notice Only allow the Slasher contract.
    modifier onlySlasher() {
        require(slasher == msg.sender, "must be slasher");
        _;
    }

    /// @notice The contract constructor.
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _renAddress The address of the RepublicToken contract.
    /// @param _minimumBond The minimum bond amount that can be submitted by a
    ///        Darknode.
    /// @param _minimumPodSize The minimum size of a Darknode pod.
    /// @param _minimumEpochInterval The minimum number of blocks between
    ///        epochs.
    function initialize(
        string _VERSION,
        RepublicToken _renAddress,
        uint256 _minimumBond,
        uint256 _minimumPodSize,
        uint256 _minimumEpochInterval
    ) public isInitializer("DarknodeRegistry", "1") {

        VERSION = _VERSION;
        ren = _renAddress;

        previousMinimumBond = _minimumBond; // todo : how to handle previous epoch parameter
        minimumBond = _minimumBond;
        nextMinimumBond = minimumBond;

        previousMinimumPodSize = _minimumPodSize;
        minimumPodSize = _minimumPodSize;
        nextMinimumPodSize = minimumPodSize;

        previousMinimumEpochInterval = _minimumEpochInterval;
        minimumEpochInterval = _minimumEpochInterval;
        nextMinimumEpochInterval = minimumEpochInterval;

        currentEpoch = Epoch({
            epochhash: uint256(blockhash(block.number - 1)),
            blocknumber: block.number
        });
        numDarknodes = 0;
        numDarknodesNextEpoch = 0;
        numDarknodesPreviousEpoch = 0;
    }

    /// @notice Register a darknode and transfer the bond to this contract.
    /// Before registering, the bond transfer must be approved in the REN
    /// contract. The caller must provide a public encryption key for the
    /// darknode. The darknode will remain pending registration until the next
    /// epoch. Only after this period can the darknode be deregistered. The
    /// caller of this method will be stored as the owner of the darknode.
    ///
    /// @param _darknodeID The darknode ID that will be registered.
    /// @param _publicKey The public key of the darknode. It is stored to allow
    ///        other darknodes and traders to encrypt messages to the trader.
    function register(address _darknodeID, bytes _publicKey) external onlyRefunded(_darknodeID) {
        // Use the current minimum bond as the darknode's bond.
        uint256 bond = minimumBond;

        // Transfer bond to store
        require(ren.transferFrom(msg.sender,this, bond), "bond transfer failed");

        // Flag this darknode for registration
        _appendDarknode(
            _darknodeID,
            msg.sender,
            bond,
            _publicKey,
            currentEpoch.blocknumber.add(minimumEpochInterval),
            0
        );

        numDarknodesNextEpoch = numDarknodesNextEpoch.add(1);

        // Emit an event.
        emit LogDarknodeRegistered(_darknodeID, bond);
    }

    /// @notice Deregister a darknode. The darknode will not be deregistered
    /// until the end of the epoch. After another epoch, the bond can be
    /// refunded by calling the refund method.
    /// @param _darknodeID The darknode ID that will be deregistered. The caller
    ///        of this method store.darknodeRegisteredAt(_darknodeID) must be
    //         the owner of this darknode.
    function deregister(address _darknodeID) external onlyDeregisterable(_darknodeID) onlyDarknodeOwner(_darknodeID) {
        deregisterDarknode(_darknodeID);
    }

    /// @notice Progress the epoch if it is possible to do so. This captures
    /// the current timestamp and current blockhash and overrides the current
    /// epoch.
    function epoch() external {
        if (previousEpoch.blocknumber == 0) {
            // The first epoch must be called by the owner of the contract
            require(msg.sender == owner, "not authorized (first epochs)");
        }

        // Require that the epoch interval has passed
        require(block.number >= currentEpoch.blocknumber.add(minimumEpochInterval), "epoch interval has not passed");
        uint256 epochhash = uint256(blockhash(block.number - 1));

        // Update the epoch hash and timestamp
        previousEpoch = currentEpoch;
        currentEpoch = Epoch({
            epochhash: epochhash,
            blocknumber: block.number
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
            emit LogMinimumEpochIntervalUpdated(minimumEpochInterval, nextMinimumEpochInterval);
        }
        if (nextSlasher != slasher) {
            slasher = nextSlasher;
            emit LogSlasherUpdated(slasher, nextSlasher);
        }

        // Emit an event
        emit LogNewEpoch();
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
    function updateMinimumPodSize(uint256 _nextMinimumPodSize) external onlyOwner {
        // Will be updated next epoch
        nextMinimumPodSize = _nextMinimumPodSize;
    }

    /// @notice Allows the contract owner to update the minimum epoch interval.
    /// @param _nextMinimumEpochInterval The minimum number of blocks between epochs.
    function updateMinimumEpochInterval(uint256 _nextMinimumEpochInterval) external onlyOwner {
        // Will be updated next epoch
        nextMinimumEpochInterval = _nextMinimumEpochInterval;
    }

    /// @notice Allow the contract owner to update the DarknodeSlasher contract
    /// address.
    /// @param _slasher The new slasher address.
    function updateSlasher(address _slasher) external onlyOwner {
        require(_slasher != 0x0, "invalid slasher address");
        nextSlasher = _slasher;
    }

    /// @notice Allow the DarknodeSlasher contract to slash half of a darknode's
    /// bond and deregister it. The bond is distributed as follows:
    ///   1/2 is kept by the guilty prover
    ///   1/8 is rewarded to the first challenger
    ///   1/8 is rewarded to the second challenger
    ///   1/4 becomes unassigned
    /// @param _prover The guilty prover whose bond is being slashed
    /// @param _challenger1 The first of the two darknodes who submitted the challenge
    /// @param _challenger2 The second of the two darknodes who submitted the challenge
    function slash(address _prover, address _challenger1, address _challenger2)
        external
        onlySlasher
    {
        uint256 penalty = _darknodeBond(_prover) / 2;
        uint256 reward = penalty / 4;

        // Slash the bond of the failed prover in half
        _updateDarknodeBond(_prover, penalty);

        // If the darknode has not been deregistered then deregister it
        if (isDeregisterable(_prover)) {
            deregisterDarknode(_prover);
        }

        // Reward the challengers with less than the penalty so that it is not
        // worth challenging yourself
        require(ren.transfer(_darknodeOwner(_challenger1), reward), "reward transfer failed");
        require(ren.transfer(_darknodeOwner(_challenger2), reward), "reward transfer failed");
    }

    /// @notice Refund the bond of a deregistered darknode. This will make the
    /// darknode available for registration again. Anyone can call this function
    /// but the bond will always be refunded to the darknode owner.
    ///
    /// @param _darknodeID The darknode ID that will be refunded. The caller
    ///        of this method must be the owner of this darknode.
    function refund(address _darknodeID) external onlyRefundable(_darknodeID) {
        address owner = _darknodeOwner(_darknodeID);

        // Remember the bond amount
        uint256 amount = _darknodeBond(_darknodeID);

        // Erase the darknode from the registry
        _removeDarknode(_darknodeID);

        // Refund the owner by transferring REN
        require(ren.transfer(owner, amount), "bond transfer failed");

        // Emit an event.
        emit LogDarknodeOwnerRefunded(_darknodeOwner(_darknodeID), amount);
    }

    /// @notice Retrieves the address of the account that registered a darknode.
    /// @param _darknodeID The ID of the darknode to retrieve the owner for.
    function getDarknodeOwner(address _darknodeID) external view returns (address) {
        return _darknodeOwner(_darknodeID);
    }

    /// @notice Retrieves the bond amount of a darknode in 10^-18 REN.
    /// @param _darknodeID The ID of the darknode to retrieve the bond for.
    function getDarknodeBond(address _darknodeID) external view returns (uint256) {
        return _darknodeBond(_darknodeID);
    }

    /// @notice Retrieves the encryption public key of the darknode.
    /// @param _darknodeID The ID of the darknode to retrieve the public key for.
    function getDarknodePublicKey(address _darknodeID) external view returns (bytes) {
        return _darknodePublicKey(_darknodeID);
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
    function getDarknodes(address _start, uint256 _count) external view returns (address[]) {
        uint256 count = _count;
        if (count == 0) {
            count = numDarknodes;
        }
        return getDarknodesFromEpochs(_start, count, false);
    }

    /// @notice Retrieves a list of darknodes which were registered for the
    /// previous epoch. See `getDarknodes` for the parameter documentation.
    function getPreviousDarknodes(address _start, uint256 _count) external view returns (address[]) {
        uint256 count = _count;
        if (count == 0) {
            count = numDarknodesPreviousEpoch;
        }
        return getDarknodesFromEpochs(_start, count, true);
    }

    /// @notice Returns whether a darknode is scheduled to become registered
    /// at next epoch.
    /// @param _darknodeID The ID of the darknode to return
    function isPendingRegistration(address _darknodeID) external view returns (bool) {
        uint256 registeredAt = _darknodeRegisteredAt(_darknodeID);
        return registeredAt != 0 && registeredAt > currentEpoch.blocknumber;
    }

    /// @notice Returns if a darknode is in the pending deregistered state. In
    /// this state a darknode is still considered registered.
    function isPendingDeregistration(address _darknodeID) external view returns (bool) {
        uint256 deregisteredAt = _darknodeDeregisteredAt(_darknodeID);
        return deregisteredAt != 0 && deregisteredAt > currentEpoch.blocknumber;
    }

    /// @notice Returns if a darknode is in the deregistered state.
    function isDeregistered(address _darknodeID) public view returns (bool) {
        uint256 deregisteredAt = _darknodeDeregisteredAt(_darknodeID);
        return deregisteredAt != 0 && deregisteredAt <= currentEpoch.blocknumber;
    }

    /// @notice Returns if a darknode can be deregistered. This is true if the
    /// darknodes is in the registered state and has not attempted to
    /// deregister yet.
    function isDeregisterable(address _darknodeID) public view returns (bool) {
        uint256 deregisteredAt = _darknodeDeregisteredAt(_darknodeID);
        // The Darknode is currently in the registered state and has not been
        // transitioned to the pending deregistration, or deregistered, state
        return isRegistered(_darknodeID) && deregisteredAt == 0;
    }

    /// @notice Returns if a darknode is in the refunded state. This is true
    /// for darknodes that have never been registered, or darknodes that have
    /// been deregistered and refunded.
    function isRefunded(address _darknodeID) public view returns (bool) {
        uint256 registeredAt = _darknodeRegisteredAt(_darknodeID);
        uint256 deregisteredAt = _darknodeDeregisteredAt(_darknodeID);
        return registeredAt == 0 && deregisteredAt == 0;
    }

    /// @notice Returns if a darknode is refundable. This is true for darknodes
    /// that have been in the deregistered state for one full epoch.
    function isRefundable(address _darknodeID) public view returns (bool) {
        return isDeregistered(_darknodeID) && _darknodeDeregisteredAt(_darknodeID) <= previousEpoch.blocknumber;
    }

    /// @notice Returns if a darknode is in the registered state.
    function isRegistered(address _darknodeID) public view returns (bool) {
        return isRegisteredInEpoch(_darknodeID, currentEpoch);
    }

    /// @notice Returns if a darknode was in the registered state last epoch.
    function isRegisteredInPreviousEpoch(address _darknodeID) public view returns (bool) {
        return isRegisteredInEpoch(_darknodeID, previousEpoch);
    }

    /// @notice Returns if a darknode was in the registered state for a given
    /// epoch.
    /// @param _darknodeID The ID of the darknode
    /// @param _epoch One of currentEpoch, previousEpoch
    function isRegisteredInEpoch(address _darknodeID, Epoch _epoch) private view returns (bool) {
        uint256 registeredAt = _darknodeRegisteredAt(_darknodeID);
        uint256 deregisteredAt = _darknodeDeregisteredAt(_darknodeID);
        bool registered = registeredAt != 0 && registeredAt <= _epoch.blocknumber;
        bool notDeregistered = deregisteredAt == 0 || deregisteredAt > _epoch.blocknumber;
        // The Darknode has been registered and has not yet been deregistered,
        // although it might be pending deregistration
        return registered && notDeregistered;
    }

    /// @notice Returns a list of darknodes registered for either the current
    /// or the previous epoch. See `getDarknodes` for documentation on the
    /// parameters `_start` and `_count`.
    /// @param _usePreviousEpoch If true, use the previous epoch, otherwise use
    ///        the current epoch.
    function getDarknodesFromEpochs(address _start, uint256 _count, bool _usePreviousEpoch) private view returns (address[]) {
        uint256 count = _count;
        if (count == 0) {
            count = numDarknodes;
        }

        address[] memory nodes = new address[](count);

        // Begin with the first node in the list
        uint256 n = 0;
        address next = _start;
        if (next == 0x0) {
            next = _begin();
        }

        // Iterate until all registered Darknodes have been collected
        while (n < count) {
            if (next == 0x0) {
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
                next = _next(next);
                continue;
            }
            nodes[n] = next;
            next = _next(next);
            n += 1;
        }
        return nodes;
    }

    /// Private function called by `deregister` and `slash`
    function deregisterDarknode(address _darknodeID) private {
        // Flag the darknode for deregistration
        _updateDarknodeDeregisteredAt(_darknodeID, currentEpoch.blocknumber.add(minimumEpochInterval));
        numDarknodesNextEpoch = numDarknodesNextEpoch.sub(1);

        // Emit an event
        emit LogDarknodeDeregistered(_darknodeID);
    }

    /// @notice Instantiates a darknode and appends it to the darknodes
    /// linked-list.
    ///
    /// @param _darknodeID The darknode's ID.
    /// @param _darknodeOwner The darknode's owner's address
    /// @param _bond The darknode's bond value
    /// @param _publicKey The darknode's public key
    /// @param _registeredAt The time stamp when the darknode is registered.
    /// @param _deregisteredAt The time stamp when the darknode is deregistered.
    function _appendDarknode(
        address _darknodeID,
        address _darknodeOwner,
        uint256 _bond,
        bytes _publicKey,
        uint256 _registeredAt,
        uint256 _deregisteredAt
    ) internal {
        Darknode memory darknode = Darknode({
            owner: _darknodeOwner,
            bond: _bond,
            publicKey: _publicKey,
            registeredAt: _registeredAt,
            deregisteredAt: _deregisteredAt
            });
        darknodeRegistry[_darknodeID] = darknode;
        LinkedList.append(darknodes, _darknodeID);
    }

    /// @notice Returns the address of the first darknode in the store
    function _begin() internal view returns(address) {
        return LinkedList.begin(darknodes);
    }

    /// @notice Returns the address of the next darknode in the store after the
    /// given address.
    function _next(address _darknodeID) internal view returns(address) {
        return LinkedList.next(darknodes, _darknodeID);
    }

    /// @notice Removes a darknode from the store and transfers its bond to the
    /// owner of this contract.
    function _removeDarknode(address _darknodeID) internal {
        uint256 bond = darknodeRegistry[_darknodeID].bond;
        delete darknodeRegistry[_darknodeID];
        LinkedList.remove(darknodes, _darknodeID);
        require(ren.transfer(owner, bond), "bond transfer failed");
    }

    /// @notice Updates the bond of a darknode. The new bond must be smaller
    /// than the previous bond of the darknode.
    function _updateDarknodeBond(address _darknodeID, uint256 _decreasedBond) internal {
        uint256 previousBond = darknodeRegistry[_darknodeID].bond;
        require(_decreasedBond < previousBond, "bond not decreased");
        darknodeRegistry[_darknodeID].bond = _decreasedBond;
        require(ren.transfer(owner, previousBond.sub(_decreasedBond)), "bond transfer failed");
    }

    /// @notice Updates the deregistration timestamp of a darknode.
    function _updateDarknodeDeregisteredAt(address _darknodeID, uint256 _deregisteredAt) internal {
        darknodeRegistry[_darknodeID].deregisteredAt = _deregisteredAt;
    }

    /// @notice Returns the owner of a given darknode.
    function _darknodeOwner(address _darknodeID) internal view returns (address) {
        return darknodeRegistry[_darknodeID].owner;
    }

    /// @notice Returns the bond of a given darknode.
    function _darknodeBond(address _darknodeID) internal view returns (uint256) {
        return darknodeRegistry[_darknodeID].bond;
    }

    /// @notice Returns the registration time of a given darknode.
    function _darknodeRegisteredAt(address _darknodeID) internal view returns (uint256) {
        return darknodeRegistry[_darknodeID].registeredAt;
    }

    /// @notice Returns the deregistration time of a given darknode.
    function _darknodeDeregisteredAt(address _darknodeID) internal view returns (uint256) {
        return darknodeRegistry[_darknodeID].deregisteredAt;
    }

    /// @notice Returns the encryption public key of a given darknode.
    function _darknodePublicKey(address _darknodeID) internal view returns (bytes) {
        return darknodeRegistry[_darknodeID].publicKey;
    }
}
