pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./RepublicToken.sol";
import "./DarknodeRegistryStore.sol";

/**
 * @notice DarknodeRegistry is responsible for the registration and
 * deregistration of dark nodes. Registration requires the deposit of a bond.
 */
contract DarknodeRegistry is Ownable {

    /**
    * @notice Darknode pods are shuffled after a fixed number of blocks.
    * An Epoch stores an epoch hash used as an (insecure) RNG seed, and the
    * blocknumber which restricts when the next epoch can be called.
    */
    struct Epoch {
        uint256 epochhash;
        uint256 blocknumber;
    }

    // Republic ERC20 token contract used to transfer bonds.
    RepublicToken ren;

    // Darknode Registry Store is the storage contract for darknodes.
    DarknodeRegistryStore private store;

    uint256 public numDarknodes;
    uint256 public numDarknodesNextEpoch;
    uint256 public numDarknodesPreviousEpoch;

    // Variables used to parameterize behavior.
    uint256 public minimumBond;
    uint256 public minimumPodSize;
    uint256 public minimumEpochInterval;
    address public slasher;

    // When one of the above variables is modified, it is only updated when the
    // next epoch is called. These variables store the values for the next epoch.
    uint256 public nextMinimumBond;
    uint256 public nextMinimumPodSize;
    uint256 public nextMinimumEpochInterval;
    address public nextSlasher;

    // The current and previous epoch
    Epoch public currentEpoch;
    Epoch public previousEpoch;

    /**
      * @notice Emitted when a darknode is registered.
      *
      * @param _darknodeID The darknode ID that was registered.
      * @param _bond The amount of REN that was transferred as bond.
      */
    event DarknodeRegistered(address _darknodeID, uint256 _bond);

    /**
      * @notice Emitted when a darknode is deregistered.
      *
      * @param _darknodeID The darknode ID that was deregistered.
      */
    event DarknodeDeregistered(address _darknodeID);

    /**
      * @notice Emitted when a refund has been made.
      *
      * @param _owner The address that was refunded.
      * @param _amount The amount of REN that was refunded.
      */
    event DarknodeOwnerRefunded(address _owner, uint256 _amount);

    /**
      * @notice Emitted when a new epoch has begun.
      */
    event NewEpoch();

    /**
      * @notice Emitted when a constructor paramater has been updated.
      */
    event MinimumBondUpdated(uint256 previousMinimumBond, uint256 nextMinimumBond);
    event MinimumPodSizeUpdated(uint256 previousMinimumPodSize, uint256 nextMinimumPodSize);
    event MinimumEpochIntervalUpdated(uint256 previousMinimumEpochInterval, uint256 nextMinimumEpochInterval);
    event SlasherUpdated(address previousSlasher, address nextSlasher);

    /**
      * @notice Only allow the owner that registered the darknode to pass.
      */
    modifier onlyDarknodeOwner(address _darknodeID) {
        require(store.darknodeOwner(_darknodeID) == msg.sender, "must be darknode owner");
        _;
    }

    /**
      * @notice Only allow unregistered dark nodes.
      */
    modifier onlyRefunded(address _darknodeID) {
        require(isRefunded(_darknodeID), "must be refunded or never registered");
        _;
    }

    modifier onlyRefundable(address _darknodeID) {
        require(isRefundable(_darknodeID), "must be deregistered for at least one epoch");
        _;
    }

    /**
      * @notice Only allowed registered nodes without a pending deregistration to
      * deregister
      */
    modifier onlyDeregisterable(address _darknodeID) {
        require(isDeregisterable(_darknodeID), "must be deregisterable");
        _;
    }

    modifier onlySlasher() {
        require(slasher == msg.sender, "must be slasher");
        _;
    }

    /**
      * @notice The DarknodeRegistry constructor.
      *
      * @param _renAddress The address of the RepublicToken contract.
      * @param _minimumBond The minimum bond amount that can be submitted by a
      *                     darknode.
      * @param _minimumPodSize The minimum size of a pod.
      * @param _minimumEpochInterval The minimum number of blocks between epochs.
      */
    constructor(RepublicToken _renAddress, DarknodeRegistryStore _storeAddress, uint256 _minimumBond, uint256 _minimumPodSize, uint256 _minimumEpochInterval) public {
        store = _storeAddress;
        ren = _renAddress;

        minimumBond = _minimumBond;
        nextMinimumBond = minimumBond;

        minimumPodSize = _minimumPodSize;
        nextMinimumPodSize = minimumPodSize;

        minimumEpochInterval = _minimumEpochInterval;
        nextMinimumEpochInterval = minimumEpochInterval;

        nextSlasher = slasher;

        currentEpoch = Epoch({
            epochhash: uint256(blockhash(block.number - 1)),
            blocknumber: block.number
        });
        numDarknodes = 0;
        numDarknodesNextEpoch = 0;
        numDarknodesPreviousEpoch = 0;
    }

    /**
      * @notice Allows the contract owner to update the minimum bond.
      * @param _nextMinimumBond The minimum bond amount that can be submitted by a
      *                         darknode.
      */
    function updateMinimumBond(uint256 _nextMinimumBond) public onlyOwner {
        // Will be updated next epoch
        nextMinimumBond = _nextMinimumBond;
    }

    /**
      * @notice Allows the contract owner to update the minimum pod size.
      * @param _nextMinimumPodSize The minimum size of a pod.
      */
    function updateMinimumPodSize(uint256 _nextMinimumPodSize) public onlyOwner {
        // Will be updated next epoch
        nextMinimumPodSize = _nextMinimumPodSize;
    }

    /**
      * @notice Allows the contract owner to update the minimum epoch interval.
      * @param _nextMinimumEpochInterval The minimum number of blocks between epochs.
      */
    function updateMinimumEpochInterval(uint256 _nextMinimumEpochInterval) public onlyOwner {
        // Will be updated next epoch
        nextMinimumEpochInterval = _nextMinimumEpochInterval;
    }

    function updateSlasher(address _slasher) public onlyOwner {
        nextSlasher = _slasher;
    }

    /**
      * @notice Progress the epoch if it is possible and necessary to do so. This
      * captures the current timestamp and current blockhash and overrides the
      * current epoch.
      */
    function epoch() public {
        if (previousEpoch.blocknumber == 0) {
            // The first two times epoch is called, it must be called by the
            // owner of the contract
            require(msg.sender == owner, "not authorised (first epochs)");
        }

        require(block.number >= currentEpoch.blocknumber + minimumEpochInterval, "epoch interval has not passed");
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

        if (nextMinimumBond != minimumBond) {
            minimumBond = nextMinimumBond;
            emit MinimumBondUpdated(minimumBond, nextMinimumBond);
        }

        if (nextMinimumPodSize != minimumPodSize) {
            minimumPodSize = nextMinimumPodSize;
            emit MinimumPodSizeUpdated(minimumPodSize, nextMinimumPodSize);
        }

        if (nextMinimumEpochInterval != minimumEpochInterval) {
            minimumEpochInterval = nextMinimumEpochInterval;
            emit MinimumEpochIntervalUpdated(minimumEpochInterval, nextMinimumEpochInterval);
        }

        if (nextSlasher != slasher) {
            slasher = nextSlasher;
            emit SlasherUpdated(slasher, nextSlasher);
        }

        // Emit an event
        emit NewEpoch();
    }

    /**
      * @notice Register a dark node and transfer the bond to this contract. The
      * caller must provide a public encryption key for the dark node as well as a
      * bond in REN. The bond must be provided as an ERC20 allowance. The dark
      * node will remain pending registration until the next epoch. Only after
      * this period can the dark node be deregistered. The caller of this method
      * will be stored as the owner of the dark node.
      *
      * @param _darknodeID The dark node ID that will be registered.
      * @param _publicKey The public key of the dark node. It is stored to allow
      *                   other dark nodes and traders to encrypt messages to the
      *                   trader.
      * @param _bond The bond that will be paid. It must be greater than, or equal
      *              to, the minimum bond.
      */
    function register(address _darknodeID, bytes _publicKey, uint256 _bond) public onlyRefunded(_darknodeID) {
        // REN allowance
        require(_bond >= minimumBond, "insufficient bond");
        // require(ren.allowance(msg.sender, address(this)) >= _bond);
        require(ren.transferFrom(msg.sender, address(this), _bond), "bond trasfer failed");
        ren.transfer(address(store), _bond);

        // Flag this dark node for registration
        store.appendDarknode(
            _darknodeID,
            msg.sender,
            _bond,
            _publicKey,
            currentEpoch.blocknumber + minimumEpochInterval,
            0
        );
        
        numDarknodesNextEpoch++;

        // Emit an event.
        emit DarknodeRegistered(_darknodeID, _bond);
    }

    /**
      * @notice Deregister a dark node. The dark node will not be deregisterd
      * until the end of the epoch. At this time, the bond can be refunded by
      * calling the refund method.
      *
      * @param _darknodeID The dark node ID that will be deregistered. The caller
      *                    of this method store.darknodeRegisteredAt(_darknodeID)must be the owner of this dark node.
      */
    function deregister(address _darknodeID) public onlyDeregisterable(_darknodeID) onlyDarknodeOwner(_darknodeID) {
        // Flag the dark node for deregistration
        store.updateDarknodeDeregisteredAt(_darknodeID, currentEpoch.blocknumber + minimumEpochInterval);
        numDarknodesNextEpoch--;

        // Emit an event
        emit DarknodeDeregistered(_darknodeID);
    }
    
    function slash(address _prover, address _challenger1, address _challenger2) public onlyDeregisterable(_challenger1) onlyDeregisterable(_challenger2) onlySlasher {
        uint256 penalty = store.darknodeBond(_prover) / 2;
        uint256 reward = penalty / 4;

        // Slash the bond of the failed provder in half
        store.updateDarknodeBond(_prover, penalty);
        
        // If the darknode has not been deregistered then deregister it
        if (isDeregisterable(_prover)) {
            store.updateDarknodeDeregisteredAt(_prover, currentEpoch.blocknumber + minimumEpochInterval);
            numDarknodesNextEpoch--;
            emit DarknodeDeregistered(_prover);
        }

        // Reward the challengers with less than the penalty so that it is not
        // worth challenging yourself
        ren.transfer(store.darknodeOwner(_challenger1), reward);
        ren.transfer(store.darknodeOwner(_challenger2), reward);
    }

    /**
      * @notice Refund the bond of a deregistered dark node. This will make the
      * dark node available for registration again.
      *
      * @param _darknodeID The dark node ID that will be refunded. The caller
      *                    of this method must be the owner of this dark node.
      */
    function refund(address _darknodeID) public onlyDarknodeOwner(_darknodeID) onlyRefundable(_darknodeID) {
        // Remember the bond amount
        uint256 amount = store.darknodeBond(_darknodeID);

        // Erase the dark node from the registry
        store.removeDarknode(_darknodeID);

        // Refund the owner by transferring REN
        ren.transfer(msg.sender, amount);

        // Emit an event.
        emit DarknodeOwnerRefunded(msg.sender, amount);
    }

    function getDarknodeOwner(address _darknodeID) public view returns (address) {
        return store.darknodeOwner(_darknodeID);
    }

    function getDarknodeBond(address _darknodeID) public view returns (uint256) {
        return store.darknodeBond(_darknodeID);
    }

    function getDarknodePublicKey(address _darknodeID) public view returns (bytes) {
        return store.darknodePublicKey(_darknodeID);
    }

    function getDarknodes(address _start, uint256 _count) public view returns (address[]) {
        uint count = _count;
        if (count == 0) {
            count = numDarknodes;
        } 

        address[] memory nodes = new address[](count);

        // Begin with the first node in the list
        uint256 n = 0;
        address next = _start;
        if (next == 0x0) {
            next = store.begin();
        }

        // Iterate until all registered Darknodes have been collected
        while (n < count) {
            if (next == 0x0) {
                break;
            }
            // Only include Darknodes that are currently registered
            if (!isRegistered(next)) {
                next = store.next(next);
                continue;
            }
            nodes[n] = next;
            next = store.next(next);
            n++;
        }

        return nodes;
    }

    function getPreviousDarknodes(address _start, uint256 _count) public view returns (address[]) {
        uint count = _count;
        if (count == 0) {
            count = numDarknodesPreviousEpoch;
        } 
        
        address[] memory nodes = new address[](count);

        // Begin with the first node in the list
        uint256 n = 0;
        address next = _start;
        if (next == 0x0) {
            next = store.begin();
        }

        // Iterate until all previously registered Darknodes have been collected
        while (n < count) {
            if (next == 0x0) {
                break;
            }
            // Only include Darknodes that were in the registered state during
            // the previous epoch
            if (!isRegisteredInPreviousEpoch(next)) {
                next = store.next(next);
                continue;
            }
            nodes[n] = next;
            next = store.next(next);
            n++;
        }

        return nodes;
    }

    function transferStoreOwnership(address newOwner) external onlyOwner {
        store.transferOwnership(newOwner);
    }

    function isPendingRegistration(address _darknodeID) public view returns (bool) {
        uint256 registeredAt = store.darknodeRegisteredAt(_darknodeID);
        return registeredAt != 0 && registeredAt > currentEpoch.blocknumber;
    }

    function isRegistered(address _darknodeID) public view returns (bool) {
        return isRegisteredInEpoch(_darknodeID, currentEpoch);
    }

    function isRegisteredInPreviousEpoch(address _darknodeID) public view returns (bool) {
        return isRegisteredInEpoch(_darknodeID, previousEpoch);
    }

    function isRegisteredInEpoch(address _darknodeID, Epoch _epoch) private view returns (bool) {
        uint256 registeredAt = store.darknodeRegisteredAt(_darknodeID);
        uint256 deregisteredAt = store.darknodeDeregisteredAt(_darknodeID);

        bool registered = registeredAt != 0 && registeredAt <= _epoch.blocknumber;
        bool notDeregistered = deregisteredAt == 0 || deregisteredAt > _epoch.blocknumber;

        // The Darknode has been registered and has not yet been deregistered,
        // although it might be pending deregistration
        return registered && notDeregistered;
    }

    function isPendingDeregistration(address _darknodeID) public view returns (bool) {
        uint256 deregisteredAt = store.darknodeDeregisteredAt(_darknodeID);
        return deregisteredAt != 0 && deregisteredAt > currentEpoch.blocknumber;
    }

    function isDeregistered(address _darknodeID) public view returns (bool) {
        uint256 deregisteredAt = store.darknodeDeregisteredAt(_darknodeID);
        return deregisteredAt != 0 && deregisteredAt <= currentEpoch.blocknumber;
    }

    function isDeregisterable(address _darknodeID) public view returns (bool) {
        uint256 deregisteredAt = store.darknodeDeregisteredAt(_darknodeID);

        // The Darknode is currently in the registered state and has not been
        // transitioned to the pending deregistration, or deregistered, state
        return isRegistered(_darknodeID) && deregisteredAt == 0;
    }

    function isRefunded(address _darknodeID) public view returns (bool) {
        uint256 registeredAt = store.darknodeRegisteredAt(_darknodeID);
        uint256 deregisteredAt = store.darknodeDeregisteredAt(_darknodeID);

        return registeredAt == 0 && deregisteredAt == 0;
    }

    function isRefundable(address _darknodeID) public view returns (bool) {

        // The Darknode is currently in the deregistered state and has been in
        // this state for at least one full epoch
        return isDeregistered(_darknodeID) && store.darknodeDeregisteredAt(_darknodeID) <= previousEpoch.blocknumber;
    }
}
