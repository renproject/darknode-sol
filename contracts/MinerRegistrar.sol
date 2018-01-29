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

  struct Miner {
    address owner;
    uint256 bond;
    bytes publicKey;
    bytes commitment;
    bytes seed;
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
   * @notice Only allow unregisterd traders to pass.
   */
  modifier onlyUnregistered(bytes20 _minerID) {
    if (!miners[_minerID].registered) {
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
  function register(bytes20 _minerID, bytes _publicKey, bytes _commitment) public onlyUnregistered(_minerID) {
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
  function deregister(bytes20 _minerID) public onlyOwner(_minerID) onlyRegistered(_traderID) {
    // Setup a refund for the owner.
    pendingRefunds[msg.sender] += miners[_minerID].bond;

    // Remove the miner from the array by overide them with the last miner.
    uint256 overridePosition = miners[_minerID].registeredPosition;
    arrayOfMiners[overridePosition] = arrayOfMiners[numberOfMiners-1];
    arrayOfMiners[overridePosition].registeredPosition = overridePosition;
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
   * @notice Check if the epoch needs to be updated, and update it if
   * necessary.
   *
   * @return True if the epoch was updated, otherwise false.
   */
  function epoch() public returns (bool) {
    // NOTE: Requires `epochInterval` < `now`
    if (now > currentEpoch.time + epochInterval) {
      currentEpoch = Epoch({
        time: now,
        blockhash: block.blockhash(block.number - 1)
      });

      // TODO: Would zeroing deregistered miners return gas?
      for (uint256 i = deregisteredCount; i < deregisteredCount + toDeregisterCount; i++) {
        delete minerList[i];
      }

      // Update counts
      deregisteredCount += toDeregisterCount;
      stayingRegisteredCount += toRegisterCount;
      toRegisterCount = 0;
      toDeregisterCount = 0;

      NextEpoch();

      return true;
    }
  
    return false;
  }

  /*** General getters ***/

  function getEpochBlockhash() public view returns (bytes32) {
    return currentEpoch.blockhash;
  }

  function getCurrentMiners() public view returns (bytes20[]) {

    var registeredStart = toDeregisterOffset();
    var registeredEnd = registeredStart + toDeregisterCount + stayingRegisteredCount;

    bytes20[] memory currentMiners = new bytes20[](toDeregisterCount + stayingRegisteredCount);

    for (uint256 i = 0; i < registeredEnd - registeredStart; i++) {
      currentMiners[i] = minerList[i + registeredStart];
    }
    return currentMiners;
  }

  // TODO: Used for debugging only?, remove before mainnet
  function getAllMiners() public view returns (bytes20[]) {
    // Note: Returns 0x0 at starting position
    return minerList;
  }

  function getMNetworkCount() public view returns (uint256) {
    // TODO: Should be rounded up?
    return (toDeregisterCount + stayingRegisteredCount) / getMNetworkSize();
  }
  
  function getMNetworkSize() public view returns (uint256) {
    uint256 log = Utils.logtwo(toDeregisterCount + stayingRegisteredCount);
    
    // If odd, add 1 to become even
    return log + (log % 2);
  }

  function getCurrentMinerCount() public view returns (uint256) {
    return (toDeregisterCount + stayingRegisteredCount);
  }

  function getNextMinerCount() public view returns (uint256) {
    return (toDeregisterCount + stayingRegisteredCount) - toDeregisterCount + toRegisterCount;
  }

  function getBond(bytes20 _minerID) public view returns (uint256) {
    // Check if they have bond pending to be withdrawn but still valid
    if (miners[_minerID].bondWithdrawalTime >= currentEpoch.time) {
      return miners[_minerID].bond + miners[_minerID].bondPendingWithdrawal;
    } else {
      return miners[_minerID].bond;
    }
  }

  function getSeed(bytes20 _minerID) public view returns (bytes32) {
    return miners[_minerID].seed;
  }
  
  // Allow anyone to see a Republic ID's public key
  function getPublicKey(bytes20 _minerID) public view returns (bytes) {
    return miners[_minerID].publicKey;
  }

  function getOwner(bytes20 _minerID) public view returns (address) {
    return Utils.ethereumAddressFromPublicKey(miners[_minerID].publicKey);
  }

  function getMinerID(address _addr) public view returns (bytes20) {
    return addressIDs[_addr];
  }

  function getBondPendingWithdrawal(bytes20 _minerID) public view returns (uint256) {
    return miners[_minerID].bondPendingWithdrawal;
  }

}
