pragma solidity ^0.4.23;

import "./libraries/LinkedList.sol";
import "./RepublicToken.sol";

/**
 * @notice DarknodeRegistry is responsible for the registration and
 * deregistration of dark nodes.
 */
contract DarknodeRegistry {

    struct Epoch {
        uint256 epochhash;
        uint256 timestamp;
    }

    /**
    * @notice DarkNodes are stored in the darkNodes. The owner is the address that
    * registered the darkNode, the bond is the amount of REN that was transferred
    * during registration, and the public key is the encryption key that should
    * be used when sending sensitive information to the darkNode. The commitment
    * and the 
    */
    struct DarkNode {
        address owner;
        uint256 bond;
        uint256 registeredAt;
        uint256 deregisteredAt;
        bytes publicKey;
    }

    // Republic ERC20 token contract used to transfer bonds.
    RepublicToken ren;

    // Registry data.
    mapping(bytes20 => DarkNode) private darknodeRegistry;
    LinkedList.List private darkNodes;
    uint256 public numDarkNodes;
    uint256 public numDarkNodesNextEpoch;

    // Constants used to parameterize behavior.
    uint256 public minimumBond;
    uint256 public minimumDarkPoolSize;
    uint256 public minimumEpochInterval;

    // The current epoch and the minimum time interval until the next epoch.
    Epoch public currentEpoch;

    /**
    * @notice Emitted when a darkNode is registered.
    * 
    * @param _darkNodeID The darkNode ID that was registered.
    * @param _bond The amount of REN that was transferred as bond.
    */
    event DarkNodeRegistered(bytes20 _darkNodeID, uint256 _bond);

    /**
    * @notice Emitted when a darkNode is deregistered.
    * 
    * @param _darkNodeID The darkNode ID that was deregistered.
    */
    event DarkNodeDeregistered(bytes20 _darkNodeID);

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
    * @notice Only allow the owner that registered the darkNode to pass.
    */
    modifier onlyOwner(bytes20 _darkNodeID) {
        require(darknodeRegistry[_darkNodeID].owner == msg.sender);
        _;
    }

    /**
    * @notice Only allow unregistered dark nodes.
    */
    modifier onlyUnregistered(bytes20 _darkNodeID) {
        require(isUnregistered(_darkNodeID));
        _;
    }

    /**
    * @notice Only allow registered dark nodes.
    */
    modifier onlyRegistered(bytes20 _darkNodeID) {
        require(isRegistered(_darkNodeID));
        _;
    }

    /**
    * @notice Only allow deregistered dark nodes.
    */
    modifier onlyDeregistered(bytes20 _darkNodeID) {
        require(isDeregistered(_darkNodeID));
        _;
    }

    /** 
    * @notice The DarknodeRegistry constructor.
    *
    * @param _token The address of the RepublicToken contract.
    * @param _minimumBond The minimum bond amount that can be submitted by a
    *                     darkNode.
    * @param _minimumDarkPoolSize The minimum size of a dark pool.
    * @param _minimumEpochInterval The minimum amount of time between epochs.
    */
    constructor(address _token, uint256 _minimumBond, uint256 _minimumDarkPoolSize, uint256 _minimumEpochInterval) public {
        ren = RepublicToken(_token);
        minimumBond = _minimumBond;
        minimumDarkPoolSize = _minimumDarkPoolSize;
        minimumEpochInterval = _minimumEpochInterval;
        currentEpoch = Epoch({
            epochhash: uint256(blockhash(block.number - 1)),
            timestamp: now
        });
        numDarkNodes = 0;
        numDarkNodesNextEpoch = 0;
    }

    /**
    * @notice Progress the epoch if it is possible and necessary to do so. This
    * captures the current timestamp and current blockhash and overrides the
    * current epoch.
    */
    function epoch() public {
        require(now > currentEpoch.timestamp + minimumEpochInterval);

        uint256 epochhash = uint256(blockhash(block.number - 1));

        // Update the epoch hash and timestamp
        currentEpoch = Epoch({
            epochhash: epochhash,
            timestamp: currentEpoch.timestamp + minimumEpochInterval
        });
        
        // Update the registry information
        numDarkNodes = numDarkNodesNextEpoch;

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
    * @param _darkNodeID The dark node ID that will be registered.
    * @param _publicKey The public key of the dark node. It is stored to allow
    *                   other dark nodes and traders to encrypt messages to the
    *                   trader.
    * @param _bond The bond that will be paid. It must be greater than, or equal
    *              to, the minimum bond.
    */
    function register(bytes20 _darkNodeID, bytes _publicKey, uint256 _bond) public onlyUnregistered(_darkNodeID) {
        // REN allowance
        require(_bond >= minimumBond);
        require(_bond <= ren.allowance(msg.sender, this));
        require(ren.transferFrom(msg.sender, this, _bond));

        // Flag this dark node for registration
        darknodeRegistry[_darkNodeID] = DarkNode({
            owner: msg.sender,
            bond: _bond,
            publicKey: _publicKey,
            registeredAt: currentEpoch.timestamp + minimumEpochInterval,
            deregisteredAt: 0
        });
        LinkedList.append(darkNodes, _darkNodeID);
        numDarkNodesNextEpoch++;

        // Emit an event.
        emit DarkNodeRegistered(_darkNodeID, _bond);
    }

    /** 
    * @notice Deregister a dark node. The dark node will not be deregisterd
    * until the end of the epoch. At this time, the bond can be refunded by
    * calling the refund method.
    *
    * @param _darkNodeID The dark node ID that will be deregistered. The caller
    *                    of this method must be the owner of this dark node.
    */
    function deregister(bytes20 _darkNodeID) public onlyRegistered(_darkNodeID) onlyOwner(_darkNodeID) {
        // Flag the dark node for deregistration
        darknodeRegistry[_darkNodeID].deregisteredAt = currentEpoch.timestamp + minimumEpochInterval;
        numDarkNodesNextEpoch--;

        // Emit an event
        emit DarkNodeDeregistered(_darkNodeID);
    }

    /** 
    * @notice Refund the bond of a deregistered dark node. This will make the
    * dark node available for registration again.
    *
    * @param _darkNodeID The dark node ID that will be refunded. The caller
    *                    of this method must be the owner of this dark node.
    */
    function refund(bytes20 _darkNodeID) public onlyOwner(_darkNodeID) onlyDeregistered(_darkNodeID) {
        // Remember the bond amount
        uint256 amount = darknodeRegistry[_darkNodeID].bond;
        assert(amount > 0);

        // Erase the dark node from the registry
        LinkedList.remove(darkNodes, _darkNodeID);
        darknodeRegistry[_darkNodeID] = DarkNode({
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

    function getOwner(bytes20 _darkNodeID) public view returns (address) {
        return darknodeRegistry[_darkNodeID].owner;
    }

    function getBond(bytes20 _darkNodeID) public view returns (uint256) {
        return darknodeRegistry[_darkNodeID].bond;
    }
    
    function getPublicKey(bytes20 _darkNodeID) public view returns (bytes) {
        return darknodeRegistry[_darkNodeID].publicKey;
    }

    function getDarkNodes() public view returns (bytes20[]) {
        bytes20[] memory nodes = new bytes20[](numDarkNodes);

        // Begin with the first node in the list
        uint256 n = 0;
        bytes20 next = LinkedList.begin(darkNodes);

        // Iterate until all registered dark nodes have been collected
        while (n < numDarkNodes) {
        // Only include registered dark nodes
            if (!isRegistered(next)) {
                next = LinkedList.next(darkNodes, next);
                continue;
            }
            nodes[n] = next;
            next = LinkedList.next(darkNodes, next);
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
    function isUnregistered(bytes20 _darkNodeID) public view returns (bool) {
        return (darknodeRegistry[_darkNodeID].registeredAt == 0);
    }

    /**
    * A registered dark node has been registered, and it is no longer pending
    * registration. It might be pending deregistration, but it has not been
    * refunded.
    */
    function isRegistered(bytes20 _darkNodeID) public view returns (bool) {
        return darknodeRegistry[_darkNodeID].registeredAt != 0 
        && darknodeRegistry[_darkNodeID].registeredAt <= currentEpoch.timestamp
        && !isDeregistered(_darkNodeID);
    }

    /**
    * A deregistered dark node has been deregistered, and it is no longer
    * pending deregistration, but has not been refunded.
    */
    function isDeregistered(bytes20 _darkNodeID) public view returns (bool) {
        return darknodeRegistry[_darkNodeID].deregisteredAt != 0
        && darknodeRegistry[_darkNodeID].deregisteredAt <= currentEpoch.timestamp;
    }

}
