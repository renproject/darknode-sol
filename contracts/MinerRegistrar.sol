pragma solidity 0.4.18;

import "./RepublicToken.sol";
import "./Utils.sol";

/**
 * Active WIP
 * TODOS:
 * 1. Break up into smaller contracts, e.g.:
 *    a. Epoch contract
 *    b. Miner list?
 *    c. Miner properties shared with traders? (e.g. public key storage)
 * 2. Remove Debug events
 */
contract MinerRegistrar {

  struct Epoch {
    bytes32 blockhash;
    uint256 timestamp;
  }

  struct Miner {
    address owner;
    uint256 bond;
    bytes publicKey;
    bytes32 commitment;
    bytes32 seed;
    bool registered;
    uint256 registeredAt;
    uint256 registeredPosition;
  }

  // Republic ERC20 token contract used to transfer bonds.
  RepublicToken ren;

  // Registry data.
  mapping(bytes20 => Miner) public miners;
  bytes20[] arrayOfMiners;
  uint256 public numberOfMiners;

  // Minimum bond to be considered registered.
  uint256 public minimumBond;

  Epoch currentEpoch;

  uint256 public minimumEpochInterval;

  // Refunable amounts of REN.
  mapping(address => uint256) public pendingRefunds;

  /**
   * @notice Emitted when a miner is registered.
   * 
   * @param _minerID The miner ID that was registered.
   * @param _bond The amount of REN that was transferred as bond.
   */
  event MinerRegistered(bytes20 _minerID, uint256 _bond);

  /**
   * @notice Emitted when a miner is deregistered.
   * 
   * @param _minerID The miner ID that was deregistered.
   */
  event MinerDeregistered(bytes20 _minerID);

  /**
   * @notice Emitted when a refund has been made.
   *
   * @param _owner The address that was refunded.
   * @param _amount The amount of REN that was refunded.
   */
  event OwnerRefunded(address _owner, uint256 _amount);

  /**
   * @notice Only allow the owner that registered the miner to pass.
   */
  modifier onlyOwner(bytes20 _minerID) {
    if (miners[_minerID].owner == msg.sender) {
      _;
    }
  }

  /**
   * @notice Only allow registerd miners to pass.
   */
  modifier onlyRegistered(bytes20 _minerID) {
    if (miners[_minerID].registered) {
      _;
    }
  }

  /**
   * @notice Only allow unregisterd miners to pass.
   */
  modifier onlyUnregistered(bytes20 _minerID) {
    if (!miners[_minerID].registered) {
      _;
    }
  }

  /**
   * @notice Only allow miners that have been unregistered for a longer enough
   * time to pass.
   */
  modifier onlyRefundable(bytes20 _minerID) {
    if (now - miners[_minerID].registeredAt >= 2*minimumEpochInterval) {
      _;
    }
  }

  /** 
   * @notice The MinerRegistrar constructor.
   *
   * @param _renAddress The address of the Republic Token contract.
   * @param _minimumBond The minimum bond amount that can be submitted by a
   *                     miner.
   * @param _minimumEpochInterval The minimum amount of time between epochs.
   */
  function MinerRegistrar(address _renAddress, uint256 _minimumBond, uint256 _minimumEpochInterval) public {
    ren = RepublicToken(_renAddress);
    minimumBond = _minimumBond;
    minimumEpochInterval = _minimumEpochInterval;
    epoch();
  }

  /** 
   * @notice Register a miner and transfer the bond to this contract. The
   * caller must provide the public key and commitment hash of the miner that
   * will be registered. The bond must be provided in REN as an allowance and
   * the entire allowance will be used.
   *
   * @param _minerID The miner ID that will be registered.
   * @param _publicKey The public key of the miner. It is stored to allow other
   *                   miners and traders to encrypt messages to the trader.
   * @param _commitment The commitment hash of the miner. It is stored and used
   *                    to generate the overlay network during each epoch.
   */
  function register(bytes20 _minerID, bytes _publicKey, bytes32 _commitment) public onlyUnregistered(_minerID) {
    // REN allowance is used as the bond.
    uint256 bond = ren.allowance(msg.sender, this);
    require(bond > minimumBond);

    // Transfer the bond to this contract.
    require(ren.transferFrom(msg.sender, this, bond));

    // Store this trader in the registry.
    miners[_minerID] = Miner({
      owner: msg.sender,
      bond: bond,
      publicKey: _publicKey,
      commitment: _commitment,
      seed: keccak256(block.blockhash(block.number - 1), _minerID),
      registered: true,
      registeredAt: now,
      registeredPosition: numberOfMiners
    });
    arrayOfMiners.push(_minerID);
    numberOfMiners++;

    // Emit an event.
    MinerRegistered(_minerID, bond);
  }

  /** 
   * @notice Deregister a miner and clear their bond for refunding. Only the
   * owner of a miner can deregister the miner.
   *
   * @param _minerID The ID of the miner that will be deregistered. The caller
   *                 must be the owner of this miner.
   */
  function deregister(bytes20 _minerID) public onlyOwner(_minerID) onlyRegistered(_minerID) onlyRefundable(_minerID) {
    // Setup a refund for the owner.
    pendingRefunds[msg.sender] += miners[_minerID].bond;

    // Remove the miner from the array by overide them with the last miner.
    uint256 overridePosition = miners[_minerID].registeredPosition;
    // Update the last miner to be at the overriden position.
    bytes20 lastMinerID = arrayOfMiners[numberOfMiners-1];
    miners[lastMinerID].registeredPosition = overridePosition;
    // Update the array of miners and delete the last position in the array.
    arrayOfMiners[overridePosition] = lastMinerID;
    delete arrayOfMiners[numberOfMiners-1];
    arrayOfMiners.length--;
    numberOfMiners--;

    // Zero the miner from the registry.
    miners[_minerID].owner = 0;
    miners[_minerID].bond = 0;
    miners[_minerID].publicKey = "";
    miners[_minerID].commitment = "";
    miners[_minerID].seed = "";
    miners[_minerID].registered = false;
    miners[_minerID].registeredAt = 0;
    miners[_minerID].registeredPosition = 0;

    // Emit an event.
    MinerDeregistered(_minerID);
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
        timestamp: now
      });
    }
  }

}
