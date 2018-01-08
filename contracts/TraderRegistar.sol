pragma solidity ^0.4.17;

// import 'zeppelin-solidity/contracts/ECRecovery.sol';
import './Utils.sol';
import "./RepublicToken.sol";

/** @title Trader Registrar */
contract TraderRegistrar {

  // TODO: Use SafeMath library?
  RepublicToken ren;

  /** Events */

  event TraderRegistered(bytes20 traderId, uint256 bond);
  event TraderBondUpdated(bytes20 traderId, uint256 newBond);
  event TraderDeregistered(bytes20 traderId);

  /** Data */

  struct Trader {
    bytes publicKey;
    address owner;
    uint256 bond;
  }

  // CONFIGURATION
  uint256 bondMinimum;

  // Map from Republic IDs to trader structs
  mapping(bytes20 => Trader) private traders;
  uint256 traderCount = 0;


  /** Modifiers */

  modifier onlyRegistered(bytes20 traderId) {
    require(traders[traderId].bond > 0);
    _;
  }


  /** Private functions */

  /**
  * @dev Returns whether or not a trader can register
  * @param traderId The republic ID of the trader
  */
  function canRegister(bytes20 traderId) private view returns (bool) {
    return traders[traderId].bond == 0;
  }

  /**
  * @dev Private function to return a traders's bond
  * Should be called at the end of a function
  *
  * @param traderId The Republic ID of the trader
  * @param toReturn The bond amount to return
  */
  function returnBond(bytes20 traderId, uint256 toReturn) private {
    require(toReturn > traders[traderId].bond);
    traders[traderId].bond -= toReturn;
    bool success = ren.transfer(msg.sender, toReturn);
    require(success);
  }



  /** Initialisation code */

  function TraderRegistrar(address renAddress, uint256 _bondMinimum) public {
    ren = RepublicToken(renAddress);
    bondMinimum = _bondMinimum;
  }



  /** Public functions */

  /** 
  * @dev Register a trader and transfer Ren bond to this contract
  * The caller must provide the public key of the account used to make the call
  *
  * register will use the entire approved Ren amount as a bond
  * another option is to allow traders to provide a bond amount as a parameter
  * or a combination, where the whole amount is taken if not specified
  *
  * @param publicKey the public key of the trader, stored to allow Republic miners to encrypt messages to the trader
  */
  function register(bytes publicKey) payable public {

    address traderAddress = Utils.addressFromPubKey(publicKey);
    bytes20 traderId = Utils.idFromPubKey(publicKey);

    // Trader should not be already registered or awaiting registration
    require(canRegister(traderId));

    // Verify that the trader has provided the correct public key
    require(msg.sender == traderAddress);

    // Set bond to be allowance plus any remaining bond from previous registration
    uint256 bond = ren.allowance(msg.sender, this);

    // Bond should be greater than minumum
    require (bond > bondMinimum);

    // Transfer Ren (ERC20 token)
    bool success = ren.transferFrom(msg.sender, this, bond);
    assert(success);

    var trader = Trader({
      publicKey: publicKey,
      owner: msg.sender,
      bond: bond
    });

    traders[traderId] = trader;
    
    traderCount += 1;

    // addressIds[traderAddress] = traderId;

    // Emit event to logs
    TraderRegistered(traderId, bond);
  }

  /**
  * @dev Increase bond or decrease a trader's bond
  * @param traderId The Republic ID of the trader
  * @param newBond The new bond to be set for the trader, greater than or less than the current bond
  */
  function updateBond(bytes20 traderId, uint256 newBond) onlyRegistered(traderId) payable public {
    
    // Only allow owner to modify bond
    address owner = Utils.addressFromPubKey(traders[traderId].publicKey);
    require(owner == msg.sender);

    // Set new bond
    require(newBond > 0);
    uint256 oldBond = traders[traderId].bond;
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

      traders[traderId].bond = newBond;


    } else if (newBond < oldBond) {
      // Decreasing bond

      uint256 toReturn = oldBond - newBond;

      // Sanity check
      assert(toReturn < oldBond);

      returnBond(traderId, toReturn);
    }

    // Emit event to logs
    TraderBondUpdated(traderId, newBond);
  }

  /** 
  * @dev Deregister a trader and return its bond
  * @param traderId the Republic ID of the trader
  */
  function deregister(bytes20 traderId) onlyRegistered(traderId) public {

    // Check that the msg.sender owns the trader
    address owner = Utils.addressFromPubKey(traders[traderId].publicKey); // store address
    require(owner == msg.sender);

    traderCount -= 1;

    // Return Ren
    uint256 toReturn = traders[traderId].bond;
    returnBond(traderId, toReturn);

    // Emit event to logs
    TraderDeregistered(traderId);
  }



  /*** General getters ***/

  function getTraderCount() public view returns (uint256) {
    return traderCount;
  }

  /*** Trader specific getters ***/

  // Getter for trader bonds, accessible by trader ID
  function getBond(bytes20 traderId) public view returns (uint256) {
    return traders[traderId].bond;
  }
 
  // Allow anyone to see a Republic ID's public key
  function getPublicKey(bytes20 traderId) public view returns (bytes) {
    return traders[traderId].publicKey;
  }

  function getAddress(bytes20 traderId) public view returns (address) {
    return Utils.addressFromPubKey(traders[traderId].publicKey);
  }

}
