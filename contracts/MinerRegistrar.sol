pragma solidity ^0.4.17;

import './Utils.sol';
import "./RepublicToken.sol";

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

  /** Contracts */

  // TODO: Use SafeMath library?
  RepublicToken ren;

  /** Data */

  struct Miner {
    bytes publicKey;
    address owner;
    uint256 bond;
    bytes32 seed;
    uint256 index;

    uint256 bondPendingWithdrawal;
    uint256 bondWithdrawalTime;
  }

  struct Epoch {
    uint256 time;
    bytes32 blockhash;
  }

  Epoch currentEpoch;

  // CONFIGURATION
  uint256 epochInterval;
  uint256 minimumBond;

  // Map from Republic IDs to miner structs
  mapping(bytes20 => Miner) private miners;

  // Map from ethereum public addresses to miner IDs
  mapping(address => bytes20) private addressIDs;

  // Layout:
  // [0, deregistered..., toDeregister..., registered..., toRegister...]
  // Since an index of 0 could be either uninitialized or 0, the first element is reserved
  bytes20[] minerList;

  uint256 deregisteredCount;
  uint256 toDeregisterCount;
  uint256 toRegisterCount;
  uint256 stayingRegisteredCount;

  /** Events */

  event MinerRegistered(bytes20 minerID, uint256 bond);
  event MinerBondUpdated(bytes20 minerID, uint256 newBond);
  event MinerDeregistered(bytes20 minerID);
  event BondRefunded(bytes20 minerID, uint256 amount);
  event Debug(string message);
  event DebugInt(uint256 num);
  event NextEpoch();
  
  /** Private functions */

  function toRegisterOffset() view private returns (uint256) {
    return stayingRegisteredOffset() + stayingRegisteredCount;
  }

  function toDeregisterOffset() view private returns (uint256) {
    return deregisteredCount + 1;
  }

  function stayingRegisteredOffset() view private returns (uint256) {
    return toDeregisterOffset() + toDeregisterCount;
  }

  function isStayingRegistered(bytes20 _minerID) private view returns (bool) {
    uint256 index = miners[_minerID].index;
    return index >= stayingRegisteredOffset() && index < toRegisterOffset();
  }

  function canRegister(bytes20 _minerID) private view returns (bool) {
    // TODO: Can register if in toDeregister
    return !isRegistered(_minerID) && !isPendingRegistration(_minerID);
  }

  function canDeregister(bytes20 _minerID) private view returns (bool) {
    return isStayingRegistered(_minerID) || isPendingRegistration(_minerID);
  }

  /**
   * @notice A private function that updates a miner's bond that is pending
   * withdrawal.
   *
   * @param _minerID The ID of the miner that is being updated.
   * @param _amount The bond update amount.
   */
  function updateBondWithdrawal(bytes20 _minerID, uint256 _amount) private {

    miners[_minerID].bond -= _amount;

    if (miners[_minerID].bondPendingWithdrawal > 0 && miners[_minerID].bondWithdrawalTime < currentEpoch.time) {
      // Can withdraw previous bond
      uint256 toWithdraw = miners[_minerID].bondPendingWithdrawal;

      // Store new amount and time
      miners[_minerID].bondPendingWithdrawal = _amount;
      miners[_minerID].bondWithdrawalTime = now;

      // Transfer Ren (ERC20 token)
      // TODO: Should this be moved to withdrawBond?
      bool success = ren.transfer(msg.sender, toWithdraw);
      require(success);

      BondRefunded(_minerID, toWithdraw);
    } else {
      // Can't withdraw any bond
      miners[_minerID].bondPendingWithdrawal += _amount;
      miners[_minerID].bondWithdrawalTime = now;
    }
  }

  /** Public functions */

  /** 
   * @notice The MinerRegistrar constructor.
   *
   * @param _renAddress The address of the Republic Token contract.
   * @param _epochInterval The amount of time between epochs, in seconds.
   * @param _minimumBond The minimum bond amount that can be submitted by a
   *                     trader.
   */
  function MinerRegistrar(address _renAddress, uint256 _epochInterval, uint256 _minimumBond) public {
    ren = RepublicToken(_renAddress);
    epochInterval = _epochInterval;
    minimumBond = _minimumBond;
    minerList.push(0x0);
    checkEpoch();
  }

  function isRegistered(bytes20 _minerID) public view returns (bool) {
    uint256 index = miners[_minerID].index;
    return index >= toDeregisterOffset() && index < toRegisterOffset();
  }

  function isPendingRegistration(bytes20 _minerID) public view returns (bool) {
    uint256 index = miners[_minerID].index;
    return index >= toRegisterOffset() && index < (toRegisterOffset() + toRegisterCount);
  }
  
  /**
   * @notice Check if the epoch needs to be updated, and update it if
   * necessary.
   *
   * @return True if the epoch was updated, otherwise false.
   */
  function checkEpoch() public returns (bool) {
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

  /** 
   * @notice Register a miner and transfer the bond to this contract. The
   * caller must provide the public key of the miner that will be registered
   * and a signature that proves the caller has access to the associated
   * private key. The bond must be provided in REN, as an allowance. The entire
   * allowance is transferred and used as the bond.
   *
   * @param _publicKey The public key of the miner. It is stored to allow other
   *                   miners and traders to encrypt messages to the miner.
   * @param _signature The Republic ID, generated from the public key and signed
   *                   by the associated private key. It is used as a proof that
   *                   the miner owns the submitted public key.
   */
  function register(bytes _publicKey, bytes _signature) payable public {

    // an outside entity will be calling this after each epochInterval has passed
    // if that has not happened yet, the next miner to register will trigger the update instead
    // checkEpoch(); // <1k gas if no update needed, >40k gas if update needed

    address minerAddress = Utils.ethereumAddressFromPublicKey(_publicKey);
    bytes20 minerID = Utils.republicIDFromPublicKey(_publicKey);

    // TODO: Check a signature instead
    // Verify that the miner has provided the correct public key
    require(msg.sender == minerAddress);

    // Miner should not be already registered or awaiting registration
    require(canRegister(minerID));

    // Set bond to be allowance plus any remaining bond from previous registration
    uint256 allowance = ren.allowance(msg.sender, this);
    // TODO: Use safe maths
    uint256 bond = allowance + miners[minerID].bondPendingWithdrawal;

    // Bond should be greater than minumum
    require (bond > minimumBond);

    // Transfer Ren (ERC20 token)
    bool success = ren.transferFrom(msg.sender, this, allowance);
    require(success);

    // Store public key and bond
    uint256 index = minerList.push(minerID) - 1;

    toRegisterCount += 1;

    bytes32 seed = keccak256(now, block.blockhash(block.number - 1), minerID);

    var miner = Miner({
      publicKey: _publicKey,
      owner: msg.sender,
      bond: bond,
      seed: seed,
      index: index,
      bondPendingWithdrawal: 0,
      bondWithdrawalTime: 0
    });

    miners[minerID] = miner;

    addressIDs[minerAddress] = minerID;

    // Emit event to logs
    MinerRegistered(minerID, bond);
  }

  /**
   * @notice Increase bond or decrease a miners's bond
   *
   * @param _minerID The Republic ID of the miner
   * @param _newBond The new bond to be set for the miner, greater than or less than the current bond
   */
  function updateBond(bytes20 _minerID, uint256 _newBond) payable public {
    // Ensure miner is already registered
    require(isPendingRegistration(_minerID) || isStayingRegistered(_minerID));
    
    // Only allow owner to modify bond
    address owner = Utils.ethereumAddressFromPublicKey(miners[_minerID].publicKey);
    require(owner == msg.sender);

    // Set new bond
    require(_newBond > 0);
    uint256 oldBond = miners[_minerID].bond;
    if (_newBond == oldBond) {
      return;
    }

    if (_newBond > oldBond) {
      // Increasing bond

      uint256 toAdd = _newBond - oldBond;

      // Sanity checks
      assert(toAdd < _newBond);
      assert(toAdd > 0);

      // Transfer Ren (ERC20 token)
      require(ren.allowance(msg.sender, this) >= toAdd);
      bool success = ren.transferFrom(msg.sender, this, toAdd);
      require(success);

      miners[_minerID].bond = _newBond;


    } else if (_newBond < oldBond) {
      // Decreasing bond

      uint256 toRefund = oldBond - _newBond;

      // Sanity check
      assert(toRefund < oldBond);

      updateBondWithdrawal(_minerID, toRefund);
    }

    // Emit event to logs
    MinerBondUpdated(_minerID, _newBond);
  }

  /** 
  * @notice Deregister a miner and refund their bond.
  *
  * @param _minerID The Republic ID of the miner.
  */
  function deregister(bytes20 _minerID) public {

    // Check that they can deregister
    require(canDeregister(_minerID));

    // Check that the msg.sender owns the miner
    require(miners[_minerID].owner == msg.sender);

    // Swap miners around
    uint256 destinationIndex;
    uint256 currentIndex = miners[_minerID].index;

    bool decreaseLength = false;

    // TODO: If miner is in toRegister, put at end of toRegister and delete, instead
    if (isPendingRegistration(_minerID)) {
      // still in toRegister

      // last in toRegister
      destinationIndex = toRegisterOffset() + toRegisterCount - 1;

      // Update count
      toRegisterCount -= 1;

      decreaseLength = true;

    } else {

      // already registered, so swap into toDeregister

      // first in registered
      destinationIndex = stayingRegisteredOffset();

      // Update count
      stayingRegisteredCount -= 1;
      toDeregisterCount += 1;
    }

    // Swap two miners in minerList
    minerList[currentIndex] = minerList[destinationIndex];
    minerList[destinationIndex] = _minerID;
    // Update their indexes
    miners[minerList[currentIndex]].index = currentIndex;
    miners[minerList[destinationIndex]].index = destinationIndex;

    if (decreaseLength) {
      delete minerList[destinationIndex]; // Never registered, so safe to delete
      minerList.length = minerList.length - 1;
    }

    updateBondWithdrawal(_minerID, miners[_minerID].bond);

    // Emit event to logs
    MinerDeregistered(_minerID);
  }

  /**
  * @notice Withdraw the bond of a miner. This is the latter of two functions a
  * miner must call to retrieve their bond. The first call is to decrease their
  * bond or deregister. This stages an amount of bond to be withdrawn. This 
  * function then allows them to actually make the withdrawal.
  *
  * @param _minerID The Republic ID of the miner.
  */
  function withdrawBond(bytes20 _minerID) public {
    updateBondWithdrawal(_minerID, 0);
  }






  /*** General getters ***/

  function getEpochBlockhash() public view returns (bytes32) {
    return currentEpoch.blockhash;
  }

  // TODO: Allow requesting miners from index i to j (to get miners in batches)
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

  function getMinerID(address _addr) public view returns (bytes20) {
    return addressIDs[_addr];
  }

  function getBondPendingWithdrawal(bytes20 _minerID) public view returns (uint256) {
    return miners[_minerID].bondPendingWithdrawal;
  }

}
