pragma solidity ^0.4.17;

import './Utils.sol';
import "./RepublicToken.sol";

contract MinerRegistrar {

  /** Contracts */

  // TODO: Use SafeMath library?
  RepublicToken ren;

  /** Events */

  event MinerRegistered(bytes20 minerId, uint256 bond);
  event MinerBondUpdated(bytes20 minerId, uint256 newBond);
  event MinerDeregistered(bytes20 minerId);
  event BondRefunded(bytes20 minerId, uint256 amount);
  event Debug(string message);
  event DebugInt(uint256 num);
  event NextEpoch();

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
  mapping(address => bytes20) private addressIds;

  // Layout:
  // [0, deregistered..., toDeregister..., registered..., toRegister...]
  // Since an index of 0 could be either uninitialized or 0, the first element is reserved
  bytes20[] minerList;

  uint256 deregisteredCount;
  uint256 willDereregisterCount;
  uint256 willRegisterCount;
  uint256 willStayRegisteredCount;
  
  /** Private functions */

  function toRegisterOffset() view private returns (uint256) {
    return stayingRegisteredOffset() + willStayRegisteredCount;
  }

  function toDeregisterOffset() view private returns (uint256) {
    return deregisteredCount + 1;
  }

  function stayingRegisteredOffset() view private returns (uint256) {
    return toDeregisterOffset() + willDereregisterCount;
  }

  function isStayingRegistered(bytes20 minerId) private view returns (bool) {
    uint256 index = miners[minerId].index;
    return index >= stayingRegisteredOffset() && index < toRegisterOffset();
  }

  function canRegister(bytes20 minerId) private view returns (bool) {
    // TODO: Can register if in toDeregister
    return !isRegistered(minerId) && !isPendingRegistration(minerId);
  }

  function canDeregister(bytes20 minerId) private view returns (bool) {
    return isStayingRegistered(minerId) || isPendingRegistration(minerId);
  }


  /**
   * @notice A private function that updates a miner's bond that is pending
   * withdrawal.
   *
   * @param minerID The ID of the miner that is being updated.
   * @param amount  The bond update amount.
   *
   * @return Nothing.
   */
  function updateBondWithdrawal(bytes20 minerID, uint256 amount) private {

    miners[minerID].bond -= amount;

    if (miners[minerID].bondPendingWithdrawal > 0 && 
        miners[minerID].bondWithdrawalTime < currentEpoch.time) {
      // Can withdraw previous bond

      uint256 toWithdraw = miners[minerID].bondPendingWithdrawal;

      // Store new amount and time
      miners[minerID].bondPendingWithdrawal = amount;
      miners[minerID].bondWithdrawalTime = now;

      // Return amount
      // Transfer Ren (ERC20 token)
      bool success = ren.transfer(msg.sender, toWithdraw);
      require(success);

      BondRefunded(minerID, toWithdraw);
    } else {
      // Can't withdraw any bond

      miners[minerID].bondPendingWithdrawal += amount;
      miners[minerID].bondWithdrawalTime = now;
    }
  }

  /** Constructor */

  function MinerRegistrar(address renAddress, uint256 _epochInterval, uint256 _minimumBond) public {
    ren = RepublicToken(renAddress);
    epochInterval = _epochInterval;
    minimumBond = _minimumBond;
    minerList.push(0x0);
    checkEpoch();
  }

  /** Public functions */

  function isRegistered(bytes20 minerId) public view returns (bool) {
    uint256 index = miners[minerId].index;

    // In [toDeregister..., registered...]
    return index >= toDeregisterOffset() && index < toRegisterOffset();
  }

  function isPendingRegistration(bytes20 minerId) public view returns (bool) {
    uint256 index = miners[minerId].index;
    return index >= toRegisterOffset() && index < (toRegisterOffset() + willRegisterCount);
  }
  
  function checkEpoch() public returns (bool) {
    // NOTE: Requires `epochInterval` < `now`
    if (now > currentEpoch.time + epochInterval) {
      currentEpoch = Epoch({
        time: now,
        blockhash: block.blockhash(block.number - 1)
      });

      // TODO: Would zeroing deregistered miners return gas?
      for (uint256 i = deregisteredCount; i < deregisteredCount + willDereregisterCount; i++) {
        delete minerList[i];
      }

      // Update counts
      deregisteredCount += willDereregisterCount;
      willStayRegisteredCount += willRegisterCount;
      willRegisterCount = 0;
      willDereregisterCount = 0;

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
   * @param publicKey The public key of the miner. It is stored to allow other
   *                  miners and traders to encrypt messages to the miner.
   * @param signature The Republic ID, generated from the public key and signed
   *                  by the associated private key. It is used as a proof that
   *                  the miner owns the submitted public key.
   */
  function register(bytes publicKey, bytes signature) payable public {

    // an outside entity will be calling this after each epochInterval has passed
    // if that has not happened yet, the next miner to register will trigger the update instead
    // checkEpoch(); // <1k gas if no update needed, >40k gas if update needed

    address minerAddress = Utils.ethereumAddressFromPublicKey(publicKey);
    bytes20 minerId = Utils.republicIDFromPublicKey(publicKey);

    // TODO: Check a signature instead
    // Verify that the miner has provided the correct public key
    require(msg.sender == minerAddress);

    // Miner should not be already registered or awaiting registration
    require(canRegister(minerId));

    // Set bond to be allowance plus any remaining bond from previous registration
    uint256 allowance = ren.allowance(msg.sender, this);
    // TODO: Use safe maths
    uint256 bond = allowance + miners[minerId].bondPendingWithdrawal;

    // Bond should be greater than minumum
    require (bond > minimumBond);

    // Transfer Ren (ERC20 token)
    bool success = ren.transferFrom(msg.sender, this, allowance);
    require(success);

    // Store public key and bond
    uint256 index = minerList.push(minerId) - 1;

    willRegisterCount += 1;

    bytes32 seed = keccak256(now, block.blockhash(block.number - 1), minerId);

    var miner = Miner({
      publicKey: publicKey,
      owner: msg.sender,
      bond: bond,
      seed: seed,
      index: index,

      bondPendingWithdrawal: 0,
      bondWithdrawalTime: 0
    });

    miners[minerId] = miner;

    addressIds[minerAddress] = minerId;

    // Emit event to logs
    MinerRegistered(minerId, bond);
  }

  /**
  * @dev Increase bond or decrease a miners's bond
  * @param minerId The Republic ID of the miner
  * @param newBond The new bond to be set for the miner, greater than or less than the current bond
  */
  function updateBond(bytes20 minerId, uint256 newBond) payable public {
    // Ensure miner is already registered
    require(isPendingRegistration(minerId) || isStayingRegistered(minerId));
    
    // Only allow owner to modify bond
    address owner = Utils.ethereumAddressFromPublicKey(miners[minerId].publicKey);
    require(owner == msg.sender);

    // Set new bond
    require(newBond > 0);
    uint256 oldBond = miners[minerId].bond;
    if (newBond == oldBond) {
      return;
    }

    if (newBond > oldBond) {
      // Increasing bond

      uint256 toAdd = newBond - oldBond;

      // Sanity checks
      assert(toAdd < newBond);
      assert(toAdd > 0);

      // Transfer Ren (ERC20 token)
      require(ren.allowance(msg.sender, this) >= toAdd);
      bool success = ren.transferFrom(msg.sender, this, toAdd);
      require(success);

      miners[minerId].bond = newBond;


    } else if (newBond < oldBond) {
      // Decreasing bond

      uint256 toRefund = oldBond - newBond;

      // Sanity check
      assert(toRefund < oldBond);

      updateBondWithdrawal(minerId, toRefund);
    }

    // Emit event to logs
    MinerBondUpdated(minerId, newBond);
  }

  /** 
  * @dev Deregister a miner and return its bond
  * @param minerId the Republic ID of the miner
  */
  function deregister(bytes20 minerId) public {

    // Check that they can deregister
    require(canDeregister(minerId));

    // Check that the msg.sender owns the miner
    require(miners[minerId].owner == msg.sender);

    // Swap miners around
    uint256 destinationIndex;
    uint256 currentIndex = miners[minerId].index;

    bool decreaseLength = false;

    // TODO: If miner is in toRegister, put at end of toRegister and delete, instead
    if (isPendingRegistration(minerId)) {
      // still in toRegister

      // last in toRegister
      destinationIndex = toRegisterOffset() + willRegisterCount - 1;

      // Update count
      willRegisterCount -= 1;

      decreaseLength = true;

    } else {

      // already registered, so swap into toDeregister

      // first in registered
      destinationIndex = stayingRegisteredOffset();

      // Update count
      willStayRegisteredCount -= 1;
      willDereregisterCount += 1;
    }

    // Swap two miners in minerList
    minerList[currentIndex] = minerList[destinationIndex];
    minerList[destinationIndex] = minerId;
    // Update their indexes
    miners[minerList[currentIndex]].index = currentIndex;
    miners[minerList[destinationIndex]].index = destinationIndex;

    if (decreaseLength) {
      delete minerList[destinationIndex]; // Never registered, so safe to delete
      minerList.length = minerList.length - 1;
    }

    updateBondWithdrawal(minerId, miners[minerId].bond);

    // Emit event to logs
    MinerDeregistered(minerId);
  }

  /**
  * @dev Withdraw the bond of a miner
  *
  * This is the latter of two functions a miner must make two calls to retrieve their bond.
  * The first call is to decrease their bond or deregister. This function then allows them to withdraw the bond.
  *
  * @param minerId The Republic ID of the miner
  */
  function withdrawBond(bytes20 minerId) public {
    updateBondWithdrawal(minerId, 0);
  }






  /*** General getters ***/

  function getCurrentMiners() public view returns (bytes20[]) {

    var registeredStart = toDeregisterOffset();
    var registeredEnd = registeredStart + willDereregisterCount + willStayRegisteredCount;

    bytes20[] memory currentMiners = new bytes20[](willDereregisterCount + willStayRegisteredCount);

    for (uint256 i = 0; i < registeredEnd - registeredStart; i++) {
      currentMiners[i] = minerList[i + registeredStart];
    }
    return currentMiners;
  }

  function getAllMiners() public view returns (bytes20[]) {
    return minerList;
  }

  function getMNetworkCount() public view returns (uint256) {
    return (willDereregisterCount + willStayRegisteredCount) / getMNetworkSize();
  }
  
  function getMNetworkSize() public view returns (uint256) {
    uint256 log = Utils.logtwo(willDereregisterCount + willStayRegisteredCount);
    
    // If odd, add 1 to become even
    return log + (log % 2);
  }

  function getCurrentMinerCount() public view returns (uint256) {
    return (willDereregisterCount + willStayRegisteredCount);
  }

  function getNextMinerCount() public view returns (uint256) {
    return (willDereregisterCount + willStayRegisteredCount) - willDereregisterCount + willRegisterCount;
  }


  /*** Miner specific getters ***/

  // Getter for miner bonds, accessible by miner ID
  function getBond(bytes20 minerId) public view returns (uint256) {
    // Check if they have bond pending to be withdrawn but still valid
    if (miners[minerId].bondWithdrawalTime >= currentEpoch.time) {
      return miners[minerId].bond + miners[minerId].bondPendingWithdrawal;
    } else {
      return miners[minerId].bond;
    }
  }

  function getSeed(bytes20 minerId) public view returns (bytes32) {
    return miners[minerId].seed;
  }
  
  // Allow anyone to see a Republic ID's public key
  function getPublicKey(bytes20 minerId) public view returns (bytes) {
    return miners[minerId].publicKey;
  }

  function getAddress(bytes20 minerId) public view returns (address) {
    return Utils.ethereumAddressFromPublicKey(miners[minerId].publicKey);
  }

  function getMinerId(address addr) public view returns (bytes20) {
    return addressIds[addr];
  }

  function getBondPendingWithdrawal(bytes20 minerId) public view returns (uint256) {
    return miners[minerId].bondPendingWithdrawal;
  }

}
