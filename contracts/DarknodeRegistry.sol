pragma solidity ^0.4.24;

import "./libraries/LinkedList.sol";
import "./RepublicToken.sol";

/**
 * @notice DarknodeRegistry is responsible for the registration and
 * deregistration of dark nodes.
 */
contract DarknodeRegistry {

    struct Epoch {
        uint256 epochhash;
        uint256 blocknumber;
    }

    /**
    * @notice Darknodes are stored in the darknodes. The owner is the address that
    * registered the darknode, the bond is the amount of REN that was transferred
    * during registration, and the public key is the encryption key that should
    * be used when sending sensitive information to the darknode. The commitment
    * and the 
    */
    struct Darknode {
        address owner;
        uint256 bond;
        uint256 registeredAt;
        uint256 deregisteredAt;
        bytes publicKey;
    }

    // Republic ERC20 token contract used to transfer bonds.
    RepublicToken ren;

    // Registry data.
    mapping(bytes20 => Darknode) private darknodeRegistry;
    LinkedList.List private darknodes;
    uint256 public numDarknodes;
    uint256 public numDarknodesNextEpoch;

    // Constants used to parameterize behavior.
    uint256 public minimumBond;
    uint256 public minimumDarkPoolSize;
    uint256 public minimumEpochInterval;

    // The current epoch and the minimum time interval until the next epoch.
    Epoch public currentEpoch;

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
    event OwnerRefunded(address _owner, uint256 _amount);

    /**
    * @notice Emitted when a new epoch has begun
    */
    event NewEpoch();

    /**
    * @notice Only allow the owner that registered the darknode to pass.
    */
    modifier onlyOwner(bytes20 _darknodeID) {
        require(darknodeRegistry[_darknodeID].owner == msg.sender);
        _;
    }

    /**
    * @notice Only allow unregistered dark nodes.
    */
    modifier onlyUnregistered(bytes20 _darknodeID) {
        require(isUnregistered(_darknodeID));
        _;
    }

    /**
    * @notice Only allow registered dark nodes.
    */
    modifier onlyRegistered(bytes20 _darknodeID) {
        require(isRegistered(_darknodeID));
        _;
    }

    /**
    * @notice Only allow deregistered dark nodes.
    */
    modifier onlyDeregistered(bytes20 _darknodeID) {
        require(isDeregistered(_darknodeID));
        _;
    }

    /**
    * @notice Only allowed registered nodes without a pending deregistration to
    * deregister
    */
    modifier onlyDeregistrable(bytes20 _darknodeID) {
        require(canDeregister(_darknodeID));
        _;
    }

    /** 
    * @notice The DarknodeRegistry constructor.
    *
    * @param _token The address of the RepublicToken contract.
    * @param _minimumBond The minimum bond amount that can be submitted by a
    *                     darknode.
    * @param _minimumDarkPoolSize The minimum size of a dark pool.
    * @param _minimumEpochInterval The minimum number of blocks between epochs.
    */
    constructor(address _token, uint256 _minimumBond, uint256 _minimumDarkPoolSize, uint256 _minimumEpochInterval) public {
        ren = RepublicToken(_token);
        minimumBond = _minimumBond;
        minimumDarkPoolSize = _minimumDarkPoolSize;
        minimumEpochInterval = _minimumEpochInterval;
        currentEpoch = Epoch({
            epochhash: uint256(blockhash(block.number - 1)),
            blocknumber: block.number
        });
        numDarknodes = 0;
        numDarknodesNextEpoch = 0;
    }

    /**
    * @notice Progress the epoch if it is possible and necessary to do so. This
    * captures the current timestamp and current blockhash and overrides the
    * current epoch.
    */
    function epoch() public {
        require(block.number >= currentEpoch.blocknumber + minimumEpochInterval);

        uint256 epochhash = uint256(blockhash(block.number - 1));

        // Update the epoch hash and timestamp
        currentEpoch = Epoch({
            epochhash: epochhash,
            blocknumber: block.number
        });

        // Update the registry information
        numDarknodes = numDarknodesNextEpoch;

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
        require(_bond >= minimumBond);
        require(ren.allowance(msg.sender, address(this)) >= _bond);
        require(ren.transferFrom(msg.sender, address(this), _bond));

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
    function deregister(bytes20 _darknodeID) public onlyDeregistrable(_darknodeID) onlyOwner(_darknodeID) {
        // Flag the dark node for deregistration
        darknodeRegistry[_darknodeID].deregisteredAt = currentEpoch.blocknumber + minimumEpochInterval;
        numDarknodesNextEpoch--;

        // Emit an event
        emit DarknodeDeregistered(_darknodeID);
    }

    /** 
    * @notice Refund the bond of a deregistered dark node. This will make the
    * dark node available for registration again.
    *
    * @param _darknodeID The dark node ID that will be refunded. The caller
    *                    of this method must be the owner of this dark node.
    */
    function refund(bytes20 _darknodeID) public onlyOwner(_darknodeID) onlyDeregistered(_darknodeID) {
        // Remember the bond amount
        uint256 amount = darknodeRegistry[_darknodeID].bond;
        require(amount > 0);

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
        require(ren.transfer(msg.sender, amount));

        // Emit an event.
        emit OwnerRefunded(msg.sender, amount);
    }

    function getOwner(bytes20 _darknodeID) public view returns (address) {
        return darknodeRegistry[_darknodeID].owner;
    }

    function getBond(bytes20 _darknodeID) public view returns (uint256) {
        return darknodeRegistry[_darknodeID].bond;
    }

    function getPublicKey(bytes20 _darknodeID) public view returns (bytes) {
        return darknodeRegistry[_darknodeID].publicKey;
    }

    function getDarknodes() public view returns (bytes20[]) {
        bytes20[] memory nodes = new bytes20[](numDarknodes);

        // Begin with the first node in the list
        uint256 n = 0;
        bytes20 next = LinkedList.begin(darknodes);

        // Iterate until all registered dark nodes have been collected
        while (n < numDarknodes) {
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

}
