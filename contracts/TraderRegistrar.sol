pragma solidity ^0.4.19;

import "./RepublicToken.sol";

contract TraderRegistrar {

  /**
   * @notice Traders are stored in the registry. The owner is the address that
   * registered the trader, the bond is the amount of REN that was transferred
   * during registration, and the public key is the encryption key that should
   * be used when sending sensitive information to the trader.
   */
  struct Trader {
    address owner;
    uint256 bond;
    bytes publicKey;
    bool registered;
  }

  // Republic ERC20 token contract used to transfer bonds.
  RepublicToken ren;

  // Registry data.
  mapping(bytes20 => Trader) public traders;
  uint256 public numberOfTraders;

  // Minimum bond to be considered registered.
  uint256 public minimumBond;

  // Refunable amounts of REN.
  mapping(address => uint256) public pendingRefunds;

  /**
   * @notice Emitted when a trader is registered.
   * 
   * @param _traderID The trader ID that was registered.
   * @param _bond The amount of REN that was transferred as bond.
   */
  event TraderRegistered(bytes20 _traderID, uint256 _bond);

  /**
   * @notice Emitted when a trader is deregistered.
   * 
   * @param _traderID The trader ID that was deregistered.
   */
  event TraderDeregistered(bytes20 _traderID);

  /**
   * @notice Emitted when a refund has been made.
   *
   * @param _owner The address that was refunded.
   * @param _amount The amount of REN that was refunded.
   */
  event OwnerRefunded(address _owner, uint256 _amount);

  /**
   * @notice Only allow the owner that registered the trader to pass.
   */
  modifier onlyOwner(bytes20 _traderID) {
    require(traders[_traderID].owner == msg.sender);
    _;
  }

  /**
   * @notice Only allow unregisterd traders to pass.
   */
  modifier onlyUnregistered(bytes20 _traderID) {
    require(!traders[_traderID].registered);
    _;
  }

  /**
   * @notice Only allow registered traders to pass.
   */
  modifier onlyRegistered(bytes20 _traderID) {
    require(traders[_traderID].registered);
    _;
  }

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
   * caller must provide the public key of the trader that will be registered.
   * The bond must be provided in REN as an allowance and the entire allowance
   * will be used.
   *
   * @param _traderID The trader ID that will be registered.
   * @param _publicKey The public key of the trader. It is stored to allow other
   *                   miners and traders to encrypt messages to the trader.
   */
  function register(bytes20 _traderID, bytes _publicKey, uint256 _bond) public onlyUnregistered(_traderID) {
    // REN allowance is used as the bond.
    require(_bond >= minimumBond);
    require(_bond <= ren.allowance(msg.sender, this));
    require(ren.transferFrom(msg.sender, this, _bond));

    // Transfer the bond to this contract.
    require(ren.transferFrom(msg.sender, this, _bond));

    // Store this trader in the registry.
    traders[_traderID] = Trader({
      owner: msg.sender,
      bond: _bond,
      publicKey: _publicKey,
      registered: true
    });
    numberOfTraders++;

    // Emit an event.
    TraderRegistered(_traderID, _bond);
  }

  /** 
   * @notice Deregister a trader and clear their bond for refunding. Only the
   * owner of a trader can deregister the trader.
   *
   * @param _traderID The ID of the trader that will be deregistered. The
   *                  caller must be the owner of this trader.
   */
  function deregister(bytes20 _traderID) public onlyOwner(_traderID) onlyRegistered(_traderID) {
    // Setup a refund for the owner.
    pendingRefunds[msg.sender] += traders[_traderID].bond;

    // Zero the trader from the registry.
    traders[_traderID].owner = 0;
    traders[_traderID].bond = 0;
    traders[_traderID].publicKey = "";
    traders[_traderID].registered = false;

    // Emit an event.
    TraderDeregistered(_traderID);
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

  function getTrader(bytes20 _traderID) public view returns (address, uint256, bytes, bool) {
    return (traders[_traderID].owner, traders[_traderID].bond, traders[_traderID].publicKey, traders[_traderID].registered);
  }

  function getNumberOfTraders() public view returns (uint256) {
    return numberOfTraders;
  }

  function getOwner(bytes20 _traderID) public view returns (address) {
    return traders[_traderID].owner;
  }

  function getBond(bytes20 _traderID) public view returns (uint256) {
    return traders[_traderID].bond;
  }
 
  function getPublicKey(bytes20 _traderID) public view returns (bytes) {
    return traders[_traderID].publicKey;
  }
}
