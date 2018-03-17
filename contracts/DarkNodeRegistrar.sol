pragma solidity 0.4.18;

import "./LinkedList.sol";
import "./RepublicToken.sol";
import "./Utils.sol";

/**
 * @notice DarkNodeRegistrar is responsible for the registration and
 * deregistration of dark nodes.
 */
contract DarkNodeRegistrar {

  struct Epoch {
    bytes32 blockhash;
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
    bytes publicKey;  
    uint256 registeredAt;
    uint256 deregisteredAt;
  }

  // Republic ERC20 token contract used to transfer bonds.
  RepublicToken ren;

  // Registry data.
  LinkedList.List private darkNodes;
  mapping(bytes20 => DarkNode) public darkNodeRegistry;
  uint256 public darkNodesNum;
  uint256 public darkNodesNumNextEpoch;
  bytes20 public darkNodesLastPendingRegistration;
  bytes20 public darkNodesLastRegistration;

  // Minimum bond to be considered registered.
  uint256 public minimumBond;

  // The current epoch and the minimum time interval until the next epoch.
  Epoch public currentEpoch;
  uint256 public minimumEpochInterval;

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

  event Debug(string str);
  event DebugBool(bool boolean);
  event DebugInt(uint256 num);
  event Debug20(bytes20 str);

  /**
   * @notice Requires that the node is in the list
   * @param self The list being called on
   * @param node The node being checked
   */
  modifier onlyInList(LinkedList.List storage self, bytes20 node) {
    require(LinkedList.isInList(self, node));
    _;
  }

  /**
   * @notice Requires that the node is NOT in the list
   * @param self The list being called on
   * @param node The node being checked
   */
  modifier onlyNotInList(LinkedList.List storage self, bytes20 node) {
    require(!LinkedList.isInList(self, node));
    _;
  }

  /**
   * @notice Only allow the owner that registered the darkNode to pass.
   */
  modifier onlyOwner(bytes20 _darkNodeID) {
    require(darkNodeRegistry[_darkNodeID].owner == msg.sender);
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
   * @notice The DarkNodeRegistrar constructor.
   *
   * @param _tokenAddress The address of the RepublicToken contract.
   * @param _minimumBond The minimum bond amount that can be submitted by a
   *                     darkNode.
   * @param _minimumEpochInterval The minimum amount of time between epochs.
   */
  function DarkNodeRegistrar(address _tokenAddress, uint256 _minimumBond, uint256 _minimumEpochInterval) public {
    ren = RepublicToken(_tokenAddress);
    minimumBond = _minimumBond;
    minimumEpochInterval = _minimumEpochInterval;
    currentEpoch = Epoch({
      blockhash: block.blockhash(block.number - 1),
      timestamp: now
    });
    darkNodesNum = 0;
    darkNodesNumNextEpoch = 0;
    darkNodesLastPendingRegistration = 0x0;
    darkNodesLastRegistration = 0x0;
  }

  /**
   * @notice Progress the epoch if it is possible and necessary to do so. This
   * captures the current timestamp and current blockhash and overrides the
   * current epoch.
   */
  function epoch() public {
    require(now > currentEpoch.timestamp + minimumEpochInterval);

    // Update the epoch hash and timestamp
    currentEpoch = Epoch({
      blockhash: block.blockhash(block.number - 1),
      timestamp: currentEpoch.timestamp + minimumEpochInterval
    });
    
    // Update the registry information
    darkNodesNum = darkNodesNumNextEpoch;
    darkNodesLastRegistration = darkNodesLastPendingRegistration;
    darkNodesLastPendingRegistration = 0x0;

    // Emit an event
    NewEpoch();
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
    LinkedList.append(darkNodes, _darkNodeID);
    darkNodeRegistry[_darkNodeID] = DarkNode({
      owner: msg.sender,
      bond: _bond,
      publicKey: _publicKey,
      registeredAt: currentEpoch.timestamp + minimumEpochInterval,
      deregisteredAt: 0
    });
    darkNodesLastPendingRegistration = _darkNodeID;
    darkNodesNumNextEpoch++;

    // Emit an event.
    DarkNodeRegistered(_darkNodeID, _bond);
  }

  /** 
   * @notice Deregister a dark node. The dark node will not be deregisterd
   * until the end of the epoch. At this time, the bond can be refunded by
   * calling the refund method.
   *
   * @param _darkNodeID The dark node ID that will be deregistered. The caller
   *                    of this method must be the owner of this dark node.
   */
  function deregister(bytes20 _darkNodeID) public onlyOwner(_darkNodeID) onlyRegistered(_darkNodeID) {
    // Flag the dark node for deregistration
    darkNodeRegistry[_darkNodeID].deregisteredAt = currentEpoch.timestamp + minimumEpochInterval;
    darkNodesNumNextEpoch--;

    // Emit an event
    DarkNodeDeregistered(_darkNodeID);
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
    uint256 amount = darkNodeRegistry[_darkNodeID].bond;
    assert(amount > 0);

    // Erase the dark node from the registry
    LinkedList.remove(darkNodes, _darkNodeID);
    darkNodeRegistry[_darkNodeID] = DarkNode({
      owner: 0x0,
      bond: 0,
      publicKey: "",
      registeredAt: 0,
      deregisteredAt: 0
    });

    // Refund the owner by transferring REN
    require(ren.transfer(msg.sender, amount));

    // Emit an event.
    OwnerRefunded(msg.sender, amount);
  }

  function getOwner(bytes20 _darkNodeID) public view returns (address) {
    return darkNodeRegistry[_darkNodeID].owner;
  }

  function getBond(bytes20 _darkNodeID) public view returns (uint256) {
    return darkNodeRegistry[_darkNodeID].bond;
  }
 
  function getPublicKey(bytes20 _darkNodeID) public view returns (bytes) {
    return darkNodeRegistry[_darkNodeID].publicKey;
  }

  function getDarkNodes() public pure returns (bytes20[]) {
    // UNIMPLEMENTED
    return new bytes20[](0);
  }

  /**
   * An unregistered dark node is not registered, deregistered, pending
   * registration, or pending deregistration. The only dark nodes that are
   * unregistered are ones that have never been registered, or have been
   * refunded.
   */
  function isUnregistered(bytes20 _darkNodeID) public view returns (bool) {
    return (darkNodeRegistry[_darkNodeID].registeredAt == 0);
  }

  /**
   * A registered dark node has been regsiterd, and it is no longer pending
   * registration. It might be pending deregistration, but it has not been
   * refunded.
   */
  function isRegistered(bytes20 _darkNodeID) public view returns (bool) {
    return darkNodeRegistry[_darkNodeID].registeredAt != 0 
      && darkNodeRegistry[_darkNodeID].registeredAt <= currentEpoch.timestamp
      && !isDeregistered(_darkNodeID);
  }

  /**
   * A deregistered dark node has been deregistered, and it is no longer
   * pending deregistration, but has not been refunded.
   */
  function isDeregistered(bytes20 _darkNodeID) public view returns (bool) {
    return darkNodeRegistry[_darkNodeID].deregisteredAt != 0
      && darkNodeRegistry[_darkNodeID].deregisteredAt <= currentEpoch.timestamp;
  }

}
