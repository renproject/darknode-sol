pragma solidity ^0.4.18;

import "./RepublicToken.sol";
import "./Utils.sol";
import "./LinkedList.sol";

/**
 * Active WIP
 * TODOS:
 * 1. Break up into smaller contracts, e.g.:
 *    a. Epoch contract
 *    b. DarkNode list?
 *    c. DarkNode properties shared with traders? (e.g. public key storage)
 * 2. Remove Debug events
 */
contract DarkNodeRegistrar {
  using Bytes20List for Bytes20List.List;

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
    bytes32 commitment;
    uint256 registeredPosition;
    uint256 registeredAt;
    uint256 deregisteredAt;
  }

  // Republic ERC20 token contract used to transfer bonds.
  RepublicToken ren;

  // Registry data.
  mapping(bytes20 => DarkNode) public darkNodes;
  Bytes20List.List private darkNodeList;

  // Minimum bond to be considered registered.
  uint256 public minimumBond;

  // The current epoch and the minimum time interval until the next epoch.
  Epoch public currentEpoch;
  uint256 public minimumEpochInterval;

  // Refunable amounts of REN.
  mapping(address => uint256) public pendingRefunds;

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
   * @notice Only allow the owner that registered the darkNode to pass.
   */
  modifier onlyOwner(bytes20 _darkNodeID) {
    if (darkNodes[_darkNodeID].owner == msg.sender) {
      _;
    }
  }

  /**
   * @notice Only allow registerd darkNodes to pass.
   */
  modifier onlyRegistered(bytes20 _darkNodeID) {
    if (isDarkNodeRegistered(_darkNodeID)) {
      _;
    }
  }

  /**
   * @notice Only allow unregisterd darkNodes to pass.
   */
  modifier onlyUnregistered(bytes20 _darkNodeID) {
    if (!isDarkNodeRegistered(_darkNodeID)) {
      _;
    }
  }

  /**
   * @notice Only allow darkNodes that have been registered for a longer enough
   * time to pass.
   */
  modifier onlyRefundable(bytes20 _darkNodeID) {
    if (darkNodes[_darkNodeID].registeredAt != 0 && darkNodes[_darkNodeID].registeredAt <= currentEpoch.timestamp) {
      _;
    }
  }

  /** 
   * @notice The DarkNodeRegistrar constructor.
   *
   * @param _renAddress The address of the Republic Token contract.
   * @param _minimumBond The minimum bond amount that can be submitted by a
   *                     darkNode.
   * @param _minimumEpochInterval The minimum amount of time between epochs.
   */
  function DarkNodeRegistrar(address _renAddress, uint256 _minimumBond, uint256 _minimumEpochInterval) public {
    ren = RepublicToken(_renAddress);
    minimumBond = _minimumBond;
    minimumEpochInterval = _minimumEpochInterval;
    currentEpoch = Epoch({
      blockhash: block.blockhash(block.number - 1),
      timestamp: now
    });
  }

  /** 
   * @notice Register a darkNode and transfer the bond to this contract. The
   * caller must provide the public key and commitment hash of the darkNode that
   * will be registered. The bond must be provided in REN as an allowance and
   * the entire allowance will be used.
   *
   * @param _darkNodeID The darkNode ID that will be registered.
   * @param _publicKey The public key of the darkNode. It is stored to allow other
   *                   darkNodes and traders to encrypt messages to the trader.
   */
  function register(bytes20 _darkNodeID, bytes _publicKey) public onlyUnregistered(_darkNodeID) {
    // REN allowance is used as the bond.
    uint256 bond = ren.allowance(msg.sender, this);
    require(bond > minimumBond);

    // Transfer the bond to this contract.
    require(ren.transferFrom(msg.sender, this, bond));

    // Store this trader in the darkNodes.
    darkNodes[_darkNodeID] = DarkNode({
      owner: msg.sender,
      bond: bond,
      publicKey: _publicKey,
      commitment: keccak256(block.blockhash(block.number - 1), _darkNodeID),
      registeredAt: currentEpoch.timestamp + minimumEpochInterval,
      deregisteredAt: 0,
      registeredPosition: 0
    });

    // Emit an event.
    DarkNodeRegistered(_darkNodeID, bond);
  }

  /** 
   * @notice Deregister a darkNode and clear their bond for refunding. Only the
   * owner of a darkNode can deregister the darkNode.
   *
   * @param _darkNodeID The ID of the darkNode that will be deregistered. The caller
   *                 must be the owner of this darkNode.
   */
  function deregister(bytes20 _darkNodeID) public onlyOwner(_darkNodeID) onlyRegistered(_darkNodeID) onlyRefundable(_darkNodeID) {
    // Setup a refund for the owner.
    pendingRefunds[msg.sender] += darkNodes[_darkNodeID].bond;

    // Zero the darkNode from the darkNodes.
    darkNodes[_darkNodeID].deregisteredAt = currentEpoch.timestamp + minimumEpochInterval;

    // Emit an event.
    DarkNodeDeregistered(_darkNodeID);
  }

  /** 
   * @notice Refund all REN that has been cleared for refunding. Bonds are
   * cleared for refunding when the respective trader is deregistered.
   */
  function refund() public {
    // Ensure that the refund amount is greater than zero.
    uint amount = pendingRefunds[msg.sender];
    require(amount > 0);

    // Refund the owner by transferring REN.
    pendingRefunds[msg.sender] = 0;
    require(ren.transfer(msg.sender, amount));

    // Emit an event.
    OwnerRefunded(msg.sender, amount);
  }
  
  /**
   * @notice Progress the epoch if it is possible and necessary to do so. This
   * captures the current timestamp and current blockhash and overrides the
   * current epoch.
   */
  function epoch() public {
    if (now > currentEpoch.timestamp + minimumEpochInterval) {
      currentEpoch = Epoch({
        blockhash: block.blockhash(block.number - 1),
        timestamp: currentEpoch.timestamp + minimumEpochInterval
      });
    }
  }

  function getDarkNode(bytes20 _darkNodeID) public view returns (DarkNode) {
    return darkNodes[_darkNodeID];
  }

  function getOwner(bytes20 _darkNodeID) public view returns (address) {
    return darkNodes[_darkNodeID].owner;
  }

  function getBond(bytes20 _darkNodeID) public view returns (uint256) {
    return darkNodes[_darkNodeID].bond;
  }
 
  function getPublicKey(bytes20 _darkNodeID) public view returns (bytes) {
    return darkNodes[_darkNodeID].publicKey;
  }
 
  function getCommitment(bytes20 _darkNodeID) public view returns (bytes32) {
    return darkNodes[_darkNodeID].commitment;
  }

  function getCurrentEpoch() public view returns (Epoch) {
    return currentEpoch;
  }

  function getXingOverlay() public view returns (bytes20[]) {
    return new bytes20[](0);
  }

  function isDarkNodeRegistered(bytes20 _darkNodeID) public view returns (bool) {
    if (darkNodes[_darkNodeID].registeredAt == 0) {
      return false;
    }
    if (darkNodes[_darkNodeID].registeredAt != 0 && darkNodes[_darkNodeID].registeredAt > currentEpoch.timestamp) {
      return false;
    }
    if (darkNodes[_darkNodeID].deregisteredAt != 0 && darkNodes[_darkNodeID].deregisteredAt <= currentEpoch.timestamp) {
      return false;
    }
    return true;
  }

}
