pragma solidity ^0.4.17;

// import 'zeppelin-solidity/contracts/ECRecovery.sol';
import './Utils.sol';
import "./RepublicToken.sol";

contract Registrar {

  RepublicToken ren;

  /*** Events ***/

  event MinerRegistered(bytes20 minerId, uint256 bond);
  event MinerBondUpdated(bytes20 minerId, uint256 newBond);
  event MinerDeregistered(bytes20 minerId);
  event ReturnedBond(bytes20 minerId, uint256 amount);
  event ScheduledBondRelease(bytes20 minerId, uint256 amount);
  event Debug(string message);
  event DebugInt(uint256 num);
  event Epoch();

  /*** Data ***/

  struct Miner {
    bytes pubkey;
    address owner;
    uint256 bond;
    bytes32 seed;
    uint256 index;

    uint256 bondPendingRelease;
    uint256 bondReleaseTime;
  }

  // Epoch
  struct CurrentEpoch {
    uint256 time;
    bytes32 blockhash;
  }
  CurrentEpoch currentEpoch;

  // CONFIGURATION
  uint256 epochInterval;
  uint256 bondMinimum;

  // Map from Republic IDs to miner structs
  mapping(bytes20 => Miner) private miners;

  // Map from ethereum public addresses to miner IDs
  mapping(address => bytes20) private addressIds;

  // Layout:
  // [0, deregistered..., toDeregister..., registered..., toRegister...]
  // Since an index of 0 could be either uninitialized or 0, the first element is reserved
  bytes20[] minerList;

  uint256 deregisteredCount;
  uint256 toDeregisterCount;
  uint256 stayingRegisteredCount;
  uint256 toRegisterCount;


  function toDeregisterOffset() view private returns (uint256) {return deregisteredCount + 1;}
  function stayingRegisteredOffset() view private returns (uint256) {return toDeregisterOffset() + toDeregisterCount;}
  function toRegisterOffset() view private returns (uint256) {return stayingRegisteredOffset() + stayingRegisteredCount;}

  function isRegistered(bytes20 minerId) public view returns (bool) {
    uint256 index = miners[minerId].index;

    // In [toDeregister..., registered...]
    return index >= toDeregisterOffset() && index < toRegisterOffset();
  }

  function isPendingRegistration(bytes20 minerId) public view returns (bool) {
    uint256 index = miners[minerId].index;

    // In [toRegister...]
    return index >= toRegisterOffset() && index < (toRegisterOffset() + toRegisterCount);
  }

  function isStayingRegistered(bytes20 minerId) private view returns (bool) {
    uint256 index = miners[minerId].index;

    // In [registered...]
    return index >= stayingRegisteredOffset() && index < toRegisterOffset();
  }

  function canRegister(bytes20 minerId) private view returns (bool) {
    // TODO: Can register if in toDeregister
    return !isRegistered(minerId) && !isPendingRegistration(minerId);
  }

  function canDeregister(bytes20 minerId) private view returns (bool) {
    return isStayingRegistered(minerId) || isPendingRegistration(minerId);
  }








  /*** Initialisation code ***/

  function Registrar(address renAddress, uint256 _epochInterval, uint256 _bondMinimum) public {
    ren = RepublicToken(renAddress);
    epochInterval = _epochInterval;
    bondMinimum = _bondMinimum;
    minerList.push(0x0);
    checkEpoch();
  }


  /*** Public functions */
  
  function checkEpoch() public returns (bool) {
    // NOTE: Requires `epochInterval` < `now`
    if (now > currentEpoch.time + epochInterval) {
      currentEpoch = CurrentEpoch({
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

      Epoch();

      return true;
    } else {
      return false;
    }
  }

  // Register a miner
  // The caller must provide the public key of the account used to make the call
  //
  // register will use the entire approved Ren amount as a bond
  // another option is to allow miners to provide a bond amount as a parameter
  // or a combination, where the whole amount is taken if not specified
  function register(bytes pubkey) payable public {
    Debug("Registering...");

    // an outside entity will be calling this after each epochInterval has passed
    // if that has not happened yet, the next miner to register will trigger the update instead
    // checkEpoch(); // <1k gas if no update needed, >40k gas if update needed

    address minerAddress = Utils.addressFromPubKey(pubkey);
    bytes20 minerId = Utils.idFromPubKey(pubkey);

    // Verify that the miner has provided the correct public key
    require(msg.sender == minerAddress);

    // Miner should not be already registered or awaiting registration
    require(canRegister(minerId));

    // Set bond to be allowance plus any remaining bond from previous registration
    uint256 allowance = ren.allowance(msg.sender, this);
    uint256 bond = allowance + miners[minerId].bondPendingRelease;

    // Bond should be greater than minumum
    require (bond > bondMinimum);

    // Transfer Ren (ERC20 token)
    bool success = ren.transferFrom(msg.sender, this, allowance);
    assert(success);

    // Store public key and bond
    uint256 index = minerList.push(minerId) - 1;

    toRegisterCount += 1;

    bytes32 seed = keccak256(now, block.blockhash(block.number - 1), minerId);

    var miner = Miner({
      pubkey: pubkey,
      owner: msg.sender,
      bond: bond,
      seed: seed,
      index: index,

      bondPendingRelease: 0,
      bondReleaseTime: 0
    });

    miners[minerId] = miner;

    addressIds[minerAddress] = minerId;

    // Emit event to logs
    MinerRegistered(minerId, bond);
  }

  // increase bond or decrease bond
  function updateBond(bytes20 minerId, uint256 newBond) payable public {
    // Ensure miner is already registered
    // Removed - bond doesn't affect isRegistered anymore
    // require(miners[minerId].bond > 0);
    
    // Only allow owner to modify bond
    address owner = Utils.addressFromPubKey(miners[minerId].pubkey);
    require(owner == msg.sender);

    // Set new bond
    require(newBond > 0);
    uint256 oldBond = miners[minerId].bond;
    if (newBond == oldBond) {return;} // could be require

    bool success;

    if (newBond > oldBond) {
      // Increasing bond

      uint256 toAdd = newBond - oldBond;

      // Sanity check
      assert(toAdd < newBond);

      // Transfer Ren (ERC20 token)
      require(ren.allowance(msg.sender, this) >= toAdd);
      success = ren.transferFrom(msg.sender, this, toAdd);
      require(success);

      miners[minerId].bond = newBond;


    } else if (newBond < oldBond) {
      // Decreasing bond

      uint256 toReturn = oldBond - newBond;

      // Sanity check
      assert(toReturn < oldBond);

      updateBondRelease(minerId, toReturn);
    }

    // Emit event to logs
    MinerBondUpdated(minerId, newBond);
  }

  function updateBondRelease(bytes20 minerId, uint256 amount) private {

    Debug("Entering updateBondRelease");

    miners[minerId].bond -= amount;

    if (miners[minerId].bondPendingRelease > 0 && 
        miners[minerId].bondReleaseTime < currentEpoch.time) {
      // Can release previous bond

      uint256 toRelease = miners[minerId].bondPendingRelease;

      // Store new amount and time
      miners[minerId].bondPendingRelease = amount;
      miners[minerId].bondReleaseTime = now;

      // Return amount
      // Transfer Ren (ERC20 token)
      bool success = ren.transfer(msg.sender, toRelease);
      require(success);

      ReturnedBond(minerId, toRelease);
    } else {
      // Can't release any bond

      miners[minerId].bondPendingRelease += amount;
      miners[minerId].bondReleaseTime = now;

      ScheduledBondRelease(minerId, amount);
    }
  }

  // deregister
  function deregister(bytes20 minerId) public {

    // Check that they can deregister
    require(canDeregister(minerId));

    // Check that the msg.sender owns the miner
    address owner = Utils.addressFromPubKey(miners[minerId].pubkey); // store address
    require(owner == msg.sender);

    // Swap miners around
    uint256 destinationIndex;
    uint256 currentIndex = miners[minerId].index;

    bool decreaseLength = false;

    // TODO: If miner is in toRegister, put at end of toRegister and delete, instead
    if (isPendingRegistration(minerId)) {
      Debug("Removing from toRegister!");
      // still in toRegister

      // last in toRegister
      destinationIndex = toRegisterOffset() + toRegisterCount - 1;

      // Update count
      toRegisterCount -= 1;

      decreaseLength = true;

    } else {
      Debug("Removing from registered!");

      // already registered, so swap into toDeregister

      // first in registered
      destinationIndex = stayingRegisteredOffset();

      // Update count
      stayingRegisteredCount -= 1;
      toDeregisterCount += 1;
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

    updateBondRelease(minerId, miners[minerId].bond);

    // Emit event to logs
    MinerDeregistered(minerId);
  }

  function releaseBond(bytes20 minerId) public {
    updateBondRelease(minerId, 0);
  }






  /*** General getters ***/

  function getCurrentMiners() public view returns (bytes20[]) {

    var registeredStart = toDeregisterOffset();
    var registeredEnd = registeredStart + toDeregisterCount + stayingRegisteredCount;

    bytes20[] memory currentMiners = new bytes20[](toDeregisterCount + stayingRegisteredCount);

    for (uint256 i = 0; i < registeredEnd - registeredStart; i++) {
      currentMiners[i] = minerList[i + registeredStart];
    }
    return currentMiners;
  }

  function getAllMiners() public view returns (bytes20[]) {
    return minerList;
  }

  function getPoolCount() public view returns (uint256) {
    return (toDeregisterCount + stayingRegisteredCount) / getPoolSize();
  }
  
  function getPoolSize() public view returns (uint256) {
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


  /*** Miner specific getters ***/

  // Getter for miner bonds, accessible by miner ID
  function getBond(bytes20 minerId) public view returns (uint256) {
    // Check if they have bond pending to be released but still valid
    if (miners[minerId].bondReleaseTime >= currentEpoch.time) {
      return miners[minerId].bond + miners[minerId].bondPendingRelease;
    } else {
      return miners[minerId].bond;
    }
  }

  function getSeed(bytes20 minerId) public view returns (bytes32) {
    return miners[minerId].seed;
  }
  
  // Allow anyone to see a Republic ID's public key
  function getPublicKey(bytes20 minerId) public view returns (bytes) {
    return miners[minerId].pubkey;
  }

  function getAddress(bytes20 minerId) public view returns (address) {
    return Utils.addressFromPubKey(miners[minerId].pubkey);
  }

  function getMinerId(address addr) public view returns (bytes20) {
    return addressIds[addr];
  }

  function getBondPendingRelease(bytes20 minerId) public view returns (uint256) {
    return miners[minerId].bondPendingRelease;
  }

}
