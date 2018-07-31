pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./libraries/LinkedList.sol";
import "./RepublicToken.sol";

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

    /**
     * @notice Darknodes are stored in the darknode struct. The owner is the
     * address that registered the darknode, the bond is the amount of REN that
     * was transferred during registration, and the public key is the encryption
     * key that should be used when sending sensitive information to the darknode.
     */
    struct Darknode {

        // The owner of a Darknode is the address that called the register
        // function. The owner is the only address that is allowed to
        // deregister the Darknode, unless the Darknode is slashed for
        // malicious behaviour.
        address owner;

        // The bond is the amount of REN submitted as a bond by the Darknode.
        // This amount is reduced when the Darknode is slashed for malicious
        // behaviour.
        uint256 bond;

        // The block numer at which the Darknode is considered registered.
        uint256 registeredAt;

        // The block numer at which the Darknode is considered deregistered.
        uint256 deregisteredAt;

        // The public key used by this Darknode for encrypting sensitive data
        // off chain. It is assumed that the Darknode has access to the
        // respective private key, and that there is an agreement on the format
        // of the public key.
        bytes publicKey;
    }

    // Republic ERC20 token contract used to transfer bonds.
    RepublicToken ren;

    // Registry data.
    mapping(bytes20 => Darknode) private darknodeRegistry;
    LinkedList.List private darknodes;
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
    event DarknodeRegistered(bytes20 _darknodeID, uint256 _bond);

    /**
      * @notice Emitted when a darknode is deregistered.
      *
      * @param _darknodeID The darknode ID that was deregistered.
      */
    event DarknodeDeregistered(bytes20 _darknodeID);

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
    modifier onlyDarknodeOwner(bytes20 _darknodeID) {
        require(darknodeRegistry[_darknodeID].owner == msg.sender, "must be darknode owner");
        _;
    }

    /**
      * @notice Only allow unregistered dark nodes.
      */
    modifier onlyUnregistered(bytes20 _darknodeID) {
        require(isUnregistered(_darknodeID), "must be unregistered");
        _;
    }

    /**
      * @notice Only allow deregistered dark nodes.
      */
    modifier onlyDeregistered(bytes20 _darknodeID) {
        require(isDeregistered(_darknodeID), "must be deregistered");
        _;
    }

    /**
      * @notice Only allowed registered nodes without a pending deregistration to
      * deregister
      */
    modifier onlyDeregistrable(bytes20 _darknodeID) {
        require(canDeregister(_darknodeID), "must be deregisterable");
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
      * @param _slasher The address of the DarknodeSlasher contract.
      */
    constructor(RepublicToken _renAddress, uint256 _minimumBond, uint256 _minimumPodSize, uint256 _minimumEpochInterval, address _slasher) public {
        ren = _renAddress;

        minimumBond = _minimumBond;
        nextMinimumBond = minimumBond;

        minimumPodSize = _minimumPodSize;
        nextMinimumPodSize = minimumPodSize;

        minimumEpochInterval = _minimumEpochInterval;
        nextMinimumEpochInterval = minimumEpochInterval;

        slasher = _slasher;
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
        // Will be updated next epoch
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
            emit MinimumBondUpdated(minimumBond, nextMinimumBond);
            minimumBond = nextMinimumBond;
        }

        if (nextMinimumPodSize != minimumPodSize) {
            emit MinimumPodSizeUpdated(minimumPodSize, nextMinimumPodSize);
            minimumPodSize = nextMinimumPodSize;
        }

        if (nextMinimumEpochInterval != minimumEpochInterval) {
            emit MinimumEpochIntervalUpdated(minimumEpochInterval, nextMinimumEpochInterval);
            minimumEpochInterval = nextMinimumEpochInterval;
        }

        if (nextSlasher != slasher) {
            emit SlasherUpdated(slasher, nextSlasher);
            slasher = nextSlasher;
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
    function register(bytes20 _darknodeID, bytes _publicKey, uint256 _bond) public onlyUnregistered(_darknodeID) {
        // REN allowance
        require(_bond >= minimumBond, "insufficient bond");
        // require(ren.allowance(msg.sender, address(this)) >= _bond);
        require(ren.transferFrom(msg.sender, address(this), _bond), "bond trasfer failed");

        // Flag this dark node for registration
        darknodeRegistry[_darknodeID] = Darknode({
            owner: msg.sender,
            bond: _bond,
            publicKey: _publicKey,
            registeredAt: currentEpoch.blocknumber + minimumEpochInterval,
            deregisteredAt: 0
        });
        LinkedList.append(darknodes, _darknodeID);
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
      *                    of this method must be the owner of this dark node.
      */
    function deregister(bytes20 _darknodeID) public onlyDeregistrable(_darknodeID) onlyDarknodeOwner(_darknodeID) {
        // Flag the dark node for deregistration
        darknodeRegistry[_darknodeID].deregisteredAt = currentEpoch.blocknumber + (3 * minimumEpochInterval);
        numDarknodesNextEpoch--;

        // Emit an event
        emit DarknodeDeregistered(_darknodeID);
    }

    function slash(bytes20 _prover, bytes20 _challenger1, bytes20 _challenger2) public onlyDeregistrable(_challenger1) onlyDeregistrable(_challenger2) onlySlasher {
        uint256 penalty = darknodeRegistry[_prover].bond / 2;
        uint256 reward = penalty / 4;

        // Slash the bond of the failed provder in half
        darknodeRegistry[_prover].bond = darknodeRegistry[_prover].bond - penalty;
        
        // If the darknode has not been deregistered then deregister it
        if (canDeregister(_prover)) {
            darknodeRegistry[_prover].deregisteredAt = currentEpoch.blocknumber + (3 * minimumEpochInterval);
            numDarknodesNextEpoch--;
            emit DarknodeDeregistered(_prover);
        }

        // Reward the challengers with less than the penalty so that it is not
        // worth challenging yourself
        require(ren.transfer(darknodeRegistry[_challenger1].owner, reward));
        require(ren.transfer(darknodeRegistry[_challenger2].owner, reward));
    }

    /**
      * @notice Refund the bond of a deregistered dark node. This will make the
      * dark node available for registration again.
      *
      * @param _darknodeID The dark node ID that will be refunded. The caller
      *                    of this method must be the owner of this dark node.
      */
    function refund(bytes20 _darknodeID) public onlyDarknodeOwner(_darknodeID) onlyDeregistered(_darknodeID) {
        // Remember the bond amount
        uint256 amount = darknodeRegistry[_darknodeID].bond;

        // Erase the dark node from the registry
        LinkedList.remove(darknodes, _darknodeID);
        darknodeRegistry[_darknodeID] = Darknode({
            owner: 0x0,
            bond: 0,
            publicKey: "",
            registeredAt: 0,
            deregisteredAt: 0
        });

        // Refund the owner by transferring REN
        require(ren.transfer(msg.sender, amount), "bond transfer failed");

        // Emit an event.
        emit DarknodeOwnerRefunded(msg.sender, amount);
    }

    function getDarknodeOwner(bytes20 _darknodeID) public view returns (address) {
        return darknodeRegistry[_darknodeID].owner;
    }

    function getBond(bytes20 _darknodeID) public view returns (uint256) {
        return darknodeRegistry[_darknodeID].bond;
    }

    function getPublicKey(bytes20 _darknodeID) public view returns (bytes) {
        return darknodeRegistry[_darknodeID].publicKey;
    }

    function getDarknodes() public view returns (bytes20[]) {
        return getFirstDarknodes(numDarknodes);
    }

    function getDarknodesFromPreviousEpoch() public view returns (bytes20[]) {
        return getFirstDarknodes(numDarknodesPreviousEpoch);
    }

    /**
      * An unregistered dark node is not registered, deregistered, pending
      * registration, or pending deregistration. The only dark nodes that are
      * unregistered are ones that have never been registered, or have been
      * refunded.
      */
    function isUnregistered(bytes20 _darknodeID) public view returns (bool) {
        return (darknodeRegistry[_darknodeID].registeredAt == 0);
    }

    /**
      * A registered dark node has been registered, and it is no longer pending
      * registration. It might be pending deregistration, but it has not been
      * refunded.
      */
    function isRegistered(bytes20 _darknodeID) public view returns (bool) {
        return darknodeRegistry[_darknodeID].registeredAt != 0
        && darknodeRegistry[_darknodeID].registeredAt <= currentEpoch.blocknumber
        && !isDeregistered(_darknodeID);
    }

    function canDeregister(bytes20 _darknodeID) public view returns (bool) {
        return isRegistered(_darknodeID)
        && darknodeRegistry[_darknodeID].deregisteredAt == 0;
    }

    /**
      * A deregistered dark node has been deregistered, and it is no longer
      * pending deregistration, but has not been refunded.
      */
    function isDeregistered(bytes20 _darknodeID) public view returns (bool) {
        return darknodeRegistry[_darknodeID].deregisteredAt != 0
        && darknodeRegistry[_darknodeID].deregisteredAt <= currentEpoch.blocknumber;
    }

    function getFirstDarknodes(uint256 limit) internal view returns (bytes20[]) {
        bytes20[] memory nodes = new bytes20[](limit);

        // Begin with the first node in the list
        uint256 n = 0;
        bytes20 next = LinkedList.begin(darknodes);

        // Iterate until all registered dark nodes have been collected
        while (n < limit) {
        // Only include registered dark nodes
            if (!isRegistered(next)) {
                next = LinkedList.next(darknodes, next);
                continue;
            }
            nodes[n] = next;
            next = LinkedList.next(darknodes, next);
            n++;
        }

        return nodes;
    }

}
