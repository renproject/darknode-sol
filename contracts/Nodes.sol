pragma solidity ^0.4.17;

// import 'zeppelin-solidity/contracts/ECRecovery.sol';
import './Utils.sol';
import "./Token.sol";

contract Nodes {

  Token ren;

  /*** Events ***/

  event NodeRegistered(bytes20 nodeId, uint256 bond);
  event NodeBondUpdated(bytes20 nodeId, uint256 newBond);
  event NodeDeregistered(bytes20 nodeId);
  event Epoch();

  /*** Data ***/

  struct Node {
    bytes pubkey;
    address owner;
    uint256 bond;
    bytes32 seed;
    uint256 index;
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

  // Map from Republic IDs to node structs
  mapping(bytes20 => Node) private nodes;

  // Map from ethereum public addresses to miner IDs
  mapping(address => bytes20) private addressIds;

  // Layout:
  // [deregistered..., toDeregister..., registered..., toRegister...]
  bytes20[] nodeList;

  uint256 deregisteredCount;
  uint256 toDeregisterCount;
  uint256 registeredCount;
  uint256 toRegisterCount;



  /*** Initialisation code ***/

  function Nodes(address renAddress, uint256 _epochInterval, uint256 _bondMinimum) public {
    ren = Token(renAddress);
    epochInterval = _epochInterval;
    bondMinimum = _bondMinimum;
    checkEpoch();
  }


  /*** Public functions */
  
  function checkEpoch() public {
    // NOTE: Requires `epochInterval` < `now`
    if (now > currentEpoch.time + epochInterval) {
      currentEpoch = CurrentEpoch({
        time: now,
        blockhash: block.blockhash(block.number - 1)
      });

      // Update counts
      deregisteredCount = deregisteredCount + toDeregisterCount;
      registeredCount = registeredCount + toRegisterCount - toDeregisterCount;
      toRegisterCount = 0;
      toDeregisterCount = 0;

      // TODO: Would zeroing deregistered nodes return gas?

      Epoch();
    }
  }

  // Register a node
  // The caller must provide the public key of the account used to make the call
  //
  // register will use the entire approved Ren amount as a bond
  // another option is to allow miners to provide a bond amount as a parameter
  // or a combination, where the whole amount is taken if not specified
  function register(bytes pubkey) payable public {

    // an outside entity will be calling this after each epochInterval has passed
    // if that has not happened yet, the next miner to register will trigger the update instead
    checkEpoch(); // <1k gas if no update needed, >40k gas if update needed

    address nodeAddress = Utils.addressFromPubKey(pubkey);
    bytes20 nodeId = Utils.idFromPubKey(pubkey);

    // Verify that the node has provided the correct public key
    require(msg.sender == nodeAddress);

    // Node should not already be registered
    require (nodes[nodeId].bond == 0);

    // Set bond to be allowance
    uint256 bond = ren.allowance(msg.sender, this);

    // Bond should be greater than minumum
    require (bond > bondMinimum);

    // Transfer Ren (ERC20 token)
    bool success = ren.transferFrom(msg.sender, this, bond);
    require(success);

    // Store public key and bond
    uint256 index = nodeList.push(nodeId) - 1;
    toRegisterCount += 1;

    bytes32 seed = keccak256(now, block.blockhash(block.number - 1), nodeId);

    var node = Node({
      pubkey: pubkey,
      owner: msg.sender,
      bond: bond,
      seed: seed,
      index: index
    });

    nodes[nodeId] = node;

    addressIds[nodeAddress] = nodeId;

    // Emit event to logs
    NodeRegistered(nodeId, bond);
  }

  // increase bond or decrease bond
  function updateBond(bytes20 nodeId, uint256 newBond) payable public {
    // Ensure node is already registered
    require(nodes[nodeId].bond > 0);
    
    // Only allow owner to increase bond (not necessary?)
    address owner = Utils.addressFromPubKey(nodes[nodeId].pubkey);
    require(owner == msg.sender);

    // Set new bond
    require(newBond > 0);
    uint256 oldBond = nodes[nodeId].bond;
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

    } else if (newBond < oldBond) {
      // Decreasing bond

      uint256 toReturn = oldBond - newBond;

      // Sanity check
      assert(toReturn < oldBond);

      // Transfer Ren (ERC20 token)
      success = ren.transfer(msg.sender, toReturn);
      require(success);
    }

    nodes[nodeId].bond = newBond;

    // Emit event to logs
    NodeBondUpdated(nodeId, newBond);
  }

  // deregister
  function deregister(bytes20 nodeId) public {

    // Lookup node and check that they are registered
    Node memory node = nodes[nodeId];
    require(node.bond > 0);

    // Check that the msg.sender owns the node
    address owner = Utils.addressFromPubKey(node.pubkey); // store address
    require(owner == msg.sender);

    // store bond amount first
    uint256 nodeBond = node.bond;

    // Swap nodes around
    uint256 destinationIndex;

    // TODO: If node is in toRegister, put at end of toRegister and delete, instead
    uint256 registeredOffset = deregisteredCount + toDeregisterCount;
    uint256 toRegisterOffset = registeredOffset + registeredCount;
    if (nodes[nodeId].index > toRegisterOffset) {
      // still in toRegister

      // last in toRegister
      destinationIndex = toRegisterOffset + registeredCount - 1;

      // Update count
      toRegisterCount -= 1;
    } else {
      // already registered, so swap into toDeregister

      // first in registered
      destinationIndex = registeredOffset;

      // Update count
      toDeregisterCount += 1;
    }

    // Swap two nodes in nodeList
    nodeList[node.index] = nodeList[destinationIndex];
    nodeList[destinationIndex] = nodeId;
    // Update their indexes
    nodes[nodeList[node.index]].index = node.index;
    nodes[nodeList[destinationIndex]].index = destinationIndex;

    // Transfer Ren (ERC20 token)
    bool success = ren.transfer(msg.sender, nodeBond);
    require(success);

    nodes[nodeId].bond = 0;

    // Emit event to logs
    NodeDeregistered(nodeId);
  }






  /*** General getters ***/

  function getCurrentNodes() public view returns (bytes20[]) {

    var registeredStart = deregisteredCount;
    var registeredEnd = registeredStart + registeredCount;

    bytes20[] memory currentNodes = new bytes20[](registeredCount);

    for (uint256 i = 0; i < registeredEnd - registeredStart; i++) {
      currentNodes[i] = nodeList[i + registeredStart];
    }
    return currentNodes;
  }
  
  function getPoolSize() public view returns (uint256) {
    uint256 log = Utils.logtwo(registeredCount);
    
    // If odd, add 1 to become even
    return log + (log % 2);
  }

  function getCurrentNodeCount() public view returns (uint256) {
    return registeredCount;
  }

  function getNextNodeCount() public view returns (uint256) {
    return registeredCount - toDeregisterCount + toRegisterCount;
  }


  /*** Miner specific getters ***/

  // Getter for node bonds, accessible by node ID
  function getBond(bytes20 nodeId) public view returns (uint256) {
    return nodes[nodeId].bond;
  }

  function getSeed(bytes20 nodeId) public view returns (bytes32) {
    return nodes[nodeId].seed;
  }

  // Getter for node registration, accessible by node ID
  function isRegistered(bytes20 nodeId) public view returns (bool) {
    return nodes[nodeId].bond > 0;
  }

  // Allow anyone to see a Republic ID's public key
  function getPublicKey(bytes20 nodeId) public view returns (bytes) {
    return nodes[nodeId].pubkey;
  }

  function getAddress(bytes20 nodeId) public view returns (address) {
    return Utils.addressFromPubKey(nodes[nodeId].pubkey);
  }

  function getMinerId(address addr) public view returns (bytes20) {
    return addressIds[addr];
  }

}
