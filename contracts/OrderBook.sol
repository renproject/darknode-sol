pragma solidity ^0.4.18;

import "./RepublicToken.sol";
import "./MinerRegistrar.sol";
import "./TraderRegistrar.sol";

/** Active WIP */
contract OrderBook {

  /** Contracts */

  RepublicToken ren;
  MinerRegistrar minerRegistrar;
  TraderRegistrar traderRegistrar;

  /** Data */

  struct MatchFragment {
    bytes20 minerID;

    bytes32 orderFragmentID1;
    bytes32 orderFragmentID2;
    bytes outputFragment;

    bytes32 zkCommitment; // bytes
  }

	struct Order {
    bytes32 orderID;
    bytes20 traderID;

		uint8 status;
    uint256 fee;
    uint256 timestamp;

    uint256 orderFragmentCount;
    mapping (bytes20 => bytes32) minersToOrderFragmentIDs;
	}

  mapping(bytes32 => MatchFragment[]) matchFragments;

  // TODO: Use enum instead
	uint8 constant STATUS_OPEN = 1;
	uint8 constant STATUS_EXPIRED = 2;
	uint8 constant STATUS_CLOSED = 3;

	uint8 public orderLimit = 100;
	uint32 public minimumOrderFee = 100000;
  
	mapping (bytes32 => Order) public orders;
	mapping (bytes32 => bytes20) owner; // orderID to owner
  mapping (bytes32 => address) refundAddress;
  mapping (bytes20 => uint) orderCount;
  mapping (bytes32 => uint) rewards;

  /** Events */

  event OrderPlaced(bytes32 _hash, bytes20 _trader);
  event OrderExpired(bytes32 _hash);
	event OrderClosed(bytes32 _hash);
  event Debug(string msg);
  event DebugAddress(address msg);
  event Debug32(bytes32 msg);
  event DebugBool(bool msg);
  event DebugInt(uint256 msg);

  /** Modifiers */
  modifier onlyOpenOrder(bytes32 orderID) {
    require(orders[orderID].status == STATUS_OPEN);
    _;
  }

  /** Private functions */

  function getKValue(uint256 orderFragmentCount) private pure returns (uint256) {
    // orderFragmentCount should be odd
    // assert(orderFragmentCount % 2 == 1);
    return (orderFragmentCount - 1) / 2 + 1;
  }


  /**
   * @notice Verify that an array of miners is registered by calling upon the
   * MinerRegistrar contract.
   *
   * @param _minerIDs The array of miner IDs that will be verified.
   *
   * @return True if all miners are registered, false otherwise.
   */
  function verifyMiners(bytes20[] _minerIDs) private returns (bool) {
    bool status = true;
    for (uint i = 0; i < _minerIDs.length && status; i++) {
      status = status && minerRegistrar.isRegistered(_minerIDs[i]); 
    }
    return status;
  }

  /** Public functions */

  /**
   * @notice The OrderBook constructor.
   *
	 * @param _republicToken The address of the REN token contract.
   * @param _minerRegistrar The address of the miner registrar contract.
   * @param _traderRegistrar The address of the trader registrar contract.
   */
  function OrderBook(address _republicToken, address _minerRegistrar, address _traderRegistrar) public {
    ren = RepublicToken(_republicToken);
    minerRegistrar = MinerRegistrar(_minerRegistrar);
    traderRegistrar = TraderRegistrar(_traderRegistrar);
  }

  /**
  * @notice Traders call this function to open an order.
  *
	* @param _orderID The hash of the order.
  * @param _orderFragmentIDs The list of hashes of the fragments.
  * @param _miners The list of miners that are authorized to close the order.
  * @param _minerLeaders ...
  */
	function openOrder(bytes32 _orderID, bytes32[] _orderFragmentIDs, bytes20[] _miners, bytes20[] _minerLeaders) public {

    bytes20 traderID = 9; /* FIXME */
    
    uint256 orderFragmentCount = minerRegistrar.getMNetworkSize();

    // Miner count should be within one of orderFragmentCount
    require(_miners.length == _orderFragmentIDs.length ||
            _miners.length == _orderFragmentIDs.length - 1);

    // Leader count should be exactly the orderFragmentCount
    require(_minerLeaders.length == _orderFragmentIDs.length);

    require(_orderFragmentIDs.length == orderFragmentCount);
    require(verifyMiners(_miners));
    require(verifyMiners(_minerLeaders));
    require(orderCount[traderID] < orderLimit);
    
    uint256 fee = ren.allowance(msg.sender, address(this));
    require(fee >= minimumOrderFee);
    require(ren.transferFrom(msg.sender, address(this), fee));
    
    orders[_orderID] = Order({
      orderID: _orderID,
      traderID: traderID,
      
      status: STATUS_OPEN,
      fee: fee,
      timestamp: now,

      orderFragmentCount: orderFragmentCount
    });

    // Approve each miner for their respective order fragment
    for (uint256 i = 0; i < _miners.length; i++ ) {
      orders[_orderID].minersToOrderFragmentIDs[_miners[i]] = _orderFragmentIDs[i];
    }
    for (uint256 j = 0; j < _minerLeaders.length; j++ ) {
      orders[_orderID].minersToOrderFragmentIDs[_minerLeaders[j]] = _orderFragmentIDs[j];
    }

    orderCount[traderID]++;
    owner[_orderID] = traderID;
    refundAddress[_orderID] = msg.sender;

		OrderPlaced(_orderID, traderID);
	}

	/**
   * @notice Traders call this function to expire an order and refund the order
   * fee.
   *
   * @param _orderID The order ID of the order that will be expired.
   */
	function expireOrder(bytes32 _orderID) public {
		require(now - orders[_orderID].timestamp > 2 days);
    orders[_orderID].status = STATUS_EXPIRED;
    orderCount[owner[_orderID]]--;
    // TODO: Get address from republic ID
    ren.transferFrom(address(this), refundAddress[_orderID], orders[_orderID].fee);
    delete owner[_orderID];
		OrderExpired(_orderID);
	}

	/**
   * @notice Miners call this function to close an order. The order is not
   * closed until 50% (or more) of the required miners have called this
   * function for the same orders. When the order is successfully closed, the
   * order fees will be evenly distributed to miners as a reward.
   *
	 * @param _orderID1 The order ID of the first order.
	 * @param _orderID2 The order ID of the second order.
   */
	function closeOrders(bytes32 _orderID1, bytes32 _orderID2) onlyOpenOrder(_orderID1) onlyOpenOrder(_orderID2) internal {
    bytes32 matchID = keccak256(_orderID1,_orderID2);

    uint256 kValue = getKValue(orders[_orderID1].orderFragmentCount);

    // require();
    uint fee = orders[_orderID1].fee + orders[_orderID2].fee / kValue;
    orders[_orderID1].status = STATUS_CLOSED;
    orders[_orderID2].status = STATUS_CLOSED;
    orderCount[owner[_orderID1]]--;
    orderCount[owner[_orderID2]]--;

    // reward miners
    for (var i = 0; i < kValue; i++) {
      bytes20 minerID = matchFragments[matchID][i].minerID;
      rewards[minerID] += fee;
    }
    delete owner[_orderID1];
    delete owner[_orderID2];
		OrderClosed(_orderID1);
    OrderClosed(_orderID2);
	}

  /**
   * @notice Check that an order fragment has been assigned to an open order
   * and that the given miner is authorized to close it.
   *
   * @param _orderID The order ID that is associated with the order fragment.
   * @param _orderFragmentID The order fragment ID that is being checked.
   * @param _minerID The miner ID that is being checked for authorization.
   *
   * @return True if the miner is authorized to close the order fragment and
   * order is open, false otherwise.
   */
  function checkOrderFragment(bytes32 _orderID, bytes32 _orderFragmentID, bytes20 _minerID) public returns(bool) {
    return (orders[_orderID].status == STATUS_OPEN && orders[_orderID].minersToOrderFragmentIDs[_minerID] == _orderFragmentID);
  }

  function submitOutputFragment(
      bytes _outputFragment,
      bytes32 _zkCommitment,
      bytes32 _orderID1,
      bytes32 _orderID2,
      bytes20 _minerID,
      bytes32 _orderFragmentID1,
      bytes32 _orderFragmentID2) public onlyOpenOrder(_orderID1) onlyOpenOrder(_orderID2)
  {

    // Check that the miner has submitted the right fragment IDs
    require(orders[_orderID1].minersToOrderFragmentIDs[_minerID] == _orderFragmentID1);
    require(orders[_orderID2].minersToOrderFragmentIDs[_minerID] == _orderFragmentID2);

    // TODO: Check that the orders have the same orderFragmentCount?
    
    // TODO: Verify zkCommitment
    
    // Check that msg.sender is the miner
    require(msg.sender == minerRegistrar.getEthereumAddress(_minerID));

    bytes32 matchID = keccak256(_orderID1,_orderID2);

    // New matchFragment
    MatchFragment storage matchFragment;
    matchFragment.outputFragment = _outputFragment;
    matchFragment.zkCommitment = _zkCommitment;
    matchFragment.minerID = _minerID;
    

    matchFragments[matchID].push(matchFragment);
    uint256 kValue = getKValue(orders[_orderID1].orderFragmentCount);
    uint256 length = matchFragments[matchID].length;
    if (length == kValue) {
      closeOrders(_orderID1, _orderID2);
    }
  }

  // TODO: Replace with getOrderStatus
  function isOrderClosed(bytes32 _orderID) public returns(bool) {
    return orders[_orderID].status == STATUS_CLOSED;
  }

  function withdrawReward(bytes20 _minerID) public {
    // TODO: Should only the owner be allowed to call this?
    address owner = minerRegistrar.getOwner(_minerID);
    require(owner == msg.sender);
    uint256 reward = rewards[_minerID];
    rewards[_minerID] = 0;
    ren.transfer(owner, reward);
  }

  function getOutput(bytes32 _orderID) public constant returns(bytes20 none) {
    // TODO: Fix (remove none in return)
    // require(orders[_orderID].status == STATUS_CLOSED);
    // return owner[orders[_orderID].matchID];
  }

  function getProofs(bytes32 _orderID) public constant returns(bytes32[]) {
    require(orders[_orderID].status == STATUS_CLOSED);
    bytes32[] storage zkCommitments;
    // TODO: Fix
    // for (var i = 0; i < orders[_orderID].outputs.length; i++) {
    //   zkCommitments.push(orders[_orderID].outputs[i].zkCommitment);
    // }
    return zkCommitments;
  }
}