pragma solidity ^0.4.17;

import "./RepublicToken.sol";
import "./Utils.sol";


/** Active WIP */
contract TraderRegistrar {

  /** Contracts */

  // TODO: Use SafeMath library?
  RepublicToken ren;

  /** Data */

  struct Trader {
    bytes publicKey;
    address owner;
    uint256 bond;
  }

  mapping(bytes20 => Trader) private traders;
  uint256 traderCount = 0;
  uint256 minimumBond;

  /** Events */

  event TraderRegistered(bytes20 traderID, uint256 bond);
  event TraderBondUpdated(bytes20 traderID, uint256 newBond);
  event TraderDeregistered(bytes20 traderID);

  /** Modifiers */

  modifier onlyRegistered(bytes20 _traderID) {
    require(traders[_traderID].bond > 0);
    _;
  }

  /** Private functions */

  /**
   * @notice Returns whether or not the trader is allowed to register. If they
   * have already submitted a bond, they are not allowed to register. Otherwise,
   * they are allowed to register.
   *
   * @param _traderID The Republic ID of the trader.
   *
   * @return True if the trader can register, false otherwise.
   */
  function canRegister(bytes20 _traderID) private view returns (bool) {
    return traders[_traderID].bond == 0;
  }

  /**
   * @notice Refund an amount of bond to a trader. This function should only be
   * called at the end of a function.
   *
   * @param _traderID The Republic ID of the trader.
   * @param _refundAmount The amount of bond to be refunded.
   */
  function refundBond(bytes20 _traderID, uint256 _refundAmount) private {
    require(_refundAmount <= traders[_traderID].bond);
    traders[_traderID].bond -= _refundAmount;
    bool success = ren.transfer(msg.sender, _refundAmount);
    require(success);
  }

  /** Public functions */

  /** 
   * @notice The TraderRegistrar constructor.
   *
   * @param _renAddress The address of the Republic Token contract.
   * @param _minimumBond The minimum bond amount that can be submitted by a
   *                     trader.
   */
  function TraderRegistrar(address _renAddress, uint256 _minimumBond) public {
    ren = RepublicToken(_renAddress);
    minimumBond = _minimumBond;
  }

  /** 
   * @notice Register a trader and transfer the bond to this contract. The
   * caller must provide the public key of the trader that will be registered
   * and a signature that proves the caller has access to the associated
   * private key. The bond must be provided in REN, as an allowance. The entire
   * allowance is transferred and used as the bond.
   *
   * @param _publicKey The public key of the trader. It is stored to allow other
   *                   miners and traders to encrypt messages to the trader.
   * @param _signature The Republic ID, generated from the public key and signed
   *                   by the associated private key. It is used as a proof that
   *                   the trader owns the submitted public key.
   */
  function register(bytes _publicKey, bytes _signature) payable public {

    address traderAddress = Utils.ethereumAddressFromPublicKey(_publicKey);
    bytes20 traderID = Utils.republicIDFromPublicKey(_publicKey);

    // Trader should not be already registered or awaiting registration
    require(canRegister(traderID));

    // TODO: Check a signature instead
    // Verify that the trader has provided the correct public key
    require(msg.sender == traderAddress);

    // Set bond to be allowance plus any remaining bond from previous registration
    uint256 bond = ren.allowance(msg.sender, this);

    // Bond should be greater than minumum
    require (bond > minimumBond);

    // Transfer Ren (ERC20 token)
    bool success = ren.transferFrom(msg.sender, this, bond);
    require(success);

    var trader = Trader({
      publicKey: _publicKey,
      owner: msg.sender,
      bond: bond
    });

    traders[traderID] = trader;
    
    traderCount += 1;

    // Emit event to logs
    TraderRegistered(traderID, bond);
  }

  /**
   * @notice Increase bond or decrease a trader's bond.
   *
   * @param _traderID The Republic ID of the trader.
   * @param _newBond The new bond to be set for the trader, greater than or less
   *                 than the current bond.
   */
  function updateBond(bytes20 _traderID, uint256 _newBond) onlyRegistered(_traderID) payable public {
    
    // Only allow owner to modify bond
    address owner = Utils.ethereumAddressFromPublicKey(traders[_traderID].publicKey);
    require(owner == msg.sender);

    // Set new bond
    require(_newBond > 0);
    uint256 oldBond = traders[_traderID].bond;
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

      traders[_traderID].bond = _newBond;


    } else if (_newBond < oldBond) {
      // Decreasing bond

      uint256 toRefund = oldBond - _newBond;

      // Sanity check
      assert(toRefund < oldBond);

      refundBond(_traderID, toRefund);
    }

    // Emit event to logs
    TraderBondUpdated(_traderID, _newBond);
  }

  /** 
   * @notice Deregister a trader and refund their bond.
   *
   * @param _traderID the Republic ID of the trader.
   */
  function deregister(bytes20 _traderID) onlyRegistered(_traderID) public {

    // Check that the msg.sender owns the trader
    address owner = Utils.ethereumAddressFromPublicKey(traders[_traderID].publicKey); // store address
    require(owner == msg.sender);

    traderCount -= 1;

    // Return Ren
    uint256 toRefund = traders[_traderID].bond;
    // TODO: Should this be called seperately (e.g. withdrawRen)?
    refundBond(_traderID, toRefund);

    // Emit event to logs
    TraderDeregistered(_traderID);
  }

  function getTraderCount() public view returns (uint256) {
    return traderCount;
  }

  function getBond(bytes20 _traderID) public view returns (uint256) {
    return traders[_traderID].bond;
  }
 
  function getPublicKey(bytes20 _traderID) public view returns (bytes) {
    return traders[_traderID].publicKey;
  }

  function getOwner(bytes20 _traderID) public view returns (address) {
    return Utils.ethereumAddressFromPublicKey(traders[_traderID].publicKey);
  }
}
