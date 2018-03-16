pragma solidity ^0.4.18;

import "./RepublicToken.sol";
import "./MinerRegistrar.sol";
import "./TraderRegistrar.sol";

/* Active WIP */
contract OrderBook {

  /* Contracts */

  RepublicToken ren;
  MinerRegistrar minerRegistrar;
  TraderRegistrar traderRegistrar;

  /* Data */

  struct MatchFragment {
    bytes20 minerID;

    bytes32 orderFragmentID1;
    bytes32 orderFragmentID2;
    bytes outputFragment;
  }

  struct Match {
    bytes32 orderID1;
    bytes32 orderID2;

    MatchFragment[] matchFragments;
  }

	struct Order {
    bytes32 orderID;
    bytes20 traderID;

		Status status;
    uint256 fee;
    uint256 timestamp;

    uint256 orderFragmentCount;
    mapping (bytes20 => bytes32) minersToOrderFragmentIDs;
	}

  // Matched order (orderID => matchID)
  // This could instead be a match from an order to another order
  mapping(bytes32 => bytes32) orderMatch;

  // Mapping from matchIDs to their matches
  mapping(bytes32 => Match) matches;

  // TODO: Use enum instead
  enum Status { Open, Expired, Closed }

	uint8 public orderLimit = 100;
	uint32 public minimumOrderFee = 100000;
  
	mapping (bytes32 => Order) public orders;
	mapping (bytes32 => bytes20) owners; // orderID to owner
  mapping (bytes32 => address) refundAddress;
  mapping (bytes20 => uint) orderCount;
  mapping (bytes32 => uint) rewards;

  /* Events */

  event OrderPlaced(bytes32 _hash, bytes20 _trader);
  event OrderExpired(bytes32 _hash);
	event OrderClosed(bytes32 _hash);
  event Debug(string msg);
  event DebugAddress(address msg);
  event Debug32(bytes32 msg);
  event DebugBool(bool msg);
  event DebugInt(uint256 msg);

  /* Modifiers */

  /**
   * @notice Only allow for orders that are currently open
   *
   * @param _orderID The ID of the order that must be open
   */
  modifier onlyOpenOrder(bytes32 _orderID) {
    require(orders[_orderID].status == Status.Open);
    _;
  }

  /**
   * @notice Only allow for orders that are currently closed
   *
   * @param _orderID The ID of the order that must be closed
   */
  modifier onlyClosedOrder(bytes32 _orderID) {
    require(orders[_orderID].status == Status.Closed);
    _;
  }

  /* Private functions */

  /**
   * Calculate the K value (number of fragments needed to be combined)
   * Should this be passed in or calculated deterministically?
   *
   * @param _orderFragmentCount The total number of fragments created
   */
  function getKValue(uint256 _orderFragmentCount) private pure returns (uint256) {
    // orderFragmentCount should be odd
    // assert(orderFragmentCount % 2 == 1);
    return (_orderFragmentCount - 1) / 2 + 1;
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

  /**
   * @notice Deterministically calculate the ID of a match based on the IDs of its two orders
   */
  function getMatchID(bytes32 _orderID1, bytes32 _orderID2) private returns (bytes32) {
    // TODO: How does solidity compare bytes?
    if (_orderID1 < _orderID2) {
      return keccak256(_orderID1, _orderID2);
    } else {
      return keccak256(_orderID2, _orderID1);
    }
  }

  /* Public functions */

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
  * @param _traderID The trader's ID
	* @param _orderID The hash of the order.
  * @param _orderFragmentIDs The list of hashes of the fragments.
  * @param _miners The list of miners that are authorized to close the order.
  * @param _minerLeaders ...
  */
	function openOrder(bytes20 _traderID, bytes32 _orderID, bytes32[] _orderFragmentIDs, bytes20[] _miners, bytes20[] _minerLeaders) public {
    
    uint256 orderFragmentCount = minerRegistrar.getMNetworkSize();

    // Miner count should be within one of orderFragmentCount
    require(_miners.length == _orderFragmentIDs.length ||
            _miners.length == _orderFragmentIDs.length - 1);

    // Leader count should be exactly the orderFragmentCount
    require(_minerLeaders.length == _orderFragmentIDs.length);

    require(_orderFragmentIDs.length == orderFragmentCount);
    require(verifyMiners(_miners));
    require(verifyMiners(_minerLeaders));
    require(orderCount[_traderID] < orderLimit);
    
    uint256 fee = ren.allowance(msg.sender, address(this));
    require(fee >= minimumOrderFee);
    require(ren.transferFrom(msg.sender, address(this), fee));
    
    orders[_orderID] = Order({
      orderID: _orderID,
      traderID: _traderID,
      
      status: Status.Open,
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

    orderCount[_traderID]++;
    owners[_orderID] = _traderID;
    refundAddress[_orderID] = msg.sender;

		OrderPlaced(_orderID, _traderID);
	}

	/**
   * @notice Traders call this function to expire an order and refund the order
   * fee.
   *
   * @param _orderID The order ID of the order that will be expired.
   */
	function expireOrder(bytes32 _orderID) public {
		require(now - orders[_orderID].timestamp > 2 days);
    orders[_orderID].status = Status.Expired;
    orderCount[owners[_orderID]]--;
    // TODO: Get address from republic ID
    ren.transfer(refundAddress[_orderID], orders[_orderID].fee);
    delete owners[_orderID];
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
    bytes32 matchID = getMatchID(_orderID1,_orderID2);
    matches[matchID].orderID1 = _orderID1;
    matches[matchID].orderID2 = _orderID2;

    uint256 kValue = getKValue(orders[_orderID1].orderFragmentCount);

    // require();
    uint fee = (orders[_orderID1].fee + orders[_orderID2].fee) / kValue;
    orders[_orderID1].status = Status.Closed;
    orders[_orderID2].status = Status.Closed;

    orderMatch[_orderID1] = matchID;
    orderMatch[_orderID2] = matchID;

    // Decrease order counts of each trader
    orderCount[owners[_orderID1]]--;
    orderCount[owners[_orderID2]]--;

    // reward miners
    for (uint256 i = 0; i < kValue; i++) {
      bytes20 minerID = matches[matchID].matchFragments[i].minerID;
      rewards[minerID] += fee;
    }
    // TODO: Do something with remainder
    // uint256 sum = (fee / kValue) * kValue;
    delete owners[_orderID1];
    delete owners[_orderID2];
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
  function checkOrderFragment(bytes32 _orderID, bytes32 _orderFragmentID, bytes20 _minerID) public returns (bool) {
    return (orders[_orderID].status == Status.Open && orders[_orderID].minersToOrderFragmentIDs[_minerID] == _orderFragmentID);
  }

  /**
   * @notice Submit an output fragment for a match. Once enough have been submitted,
   * the order is closed.
   *
   * @param _outputFragment ...
   * @param _orderID1 ...
   * @param _orderID2 ...
   * @param _minerID ...
   * @param _orderFragmentID1 ...
   * @param _orderFragmentID2 ...
   */
  function submitOutputFragment(
      bytes _outputFragment,
      bytes32 _orderID1,
      bytes32 _orderID2,
      bytes20 _minerID,
      bytes32 _orderFragmentID1,
      bytes32 _orderFragmentID2) public onlyOpenOrder(_orderID1) onlyOpenOrder(_orderID2)
  {

    // Check that the miner has submitted the right fragment IDs
    require(orders[_orderID1].minersToOrderFragmentIDs[_minerID] == _orderFragmentID1);
    require(_orderFragmentID1 != 0x0);
    require(orders[_orderID2].minersToOrderFragmentIDs[_minerID] == _orderFragmentID2);
    require(_orderFragmentID2 != 0x0);

    // TODO: Check that the orders have the same orderFragmentCount?
        
    // Check that msg.sender is the miner
    require(msg.sender == minerRegistrar.getEthereumAddress(_minerID));

    bytes32 matchID = getMatchID(_orderID2,_orderID1);

    // New matchFragment
    matches[matchID].matchFragments.push(MatchFragment({
      outputFragment: _outputFragment,
      minerID: _minerID,
      orderFragmentID1: _orderFragmentID1,
      orderFragmentID2: _orderFragmentID2
    }));

    uint256 kValue = getKValue(orders[_orderID1].orderFragmentCount);
    uint256 length = matches[matchID].matchFragments.length;
    if (length == kValue) {
      closeOrders(_orderID1, _orderID2);
    }
  }

  /**
   * @notice Allow a miner to withdraw their reward to the Ethereum address used
   * to register them
   *
   * @param _minerID The ID of the miner
   */
  function withdrawReward(bytes20 _minerID) public {
    address owner = minerRegistrar.getOwner(_minerID);

    // Should anyone be able to call this?
    require(owner == msg.sender);

    uint256 reward = rewards[_minerID];
    rewards[_minerID] = 0;
    ren.transfer(owner, reward);
  }

  /**
   * @notice Get the reward amount a miner can withdraw
   *
   * @param _minerID The ID of the miner
   * @return The reward in Ren?
   */
  function getReward(bytes20 _minerID) public view returns (uint256) {
    return rewards[_minerID];
  }

  /**
   * @notice Get the status of an order
   *
   * @param _orderID The ID of the order
   * @return The status as a number?, corresponding to the enum { Open, Expired, Closed }
   */
  function getOrderStatus(bytes32 _orderID) public view returns (Status) {
    return orders[_orderID].status;
  }

  /**
   * @notice Get the status of a match
   *
   * @param _matchID The ID of the match
   * @return The status as a number?, corresponding to the enum { Open, Expired, Closed }
   */
  function getMatchStatus(bytes32 _matchID) public view returns (Status) {
    Status status1 = orders[matches[_matchID].orderID1].status;
    Status status2 = orders[matches[_matchID].orderID2].status;
    require(status1 == status2);
    return status1;
  }

  /**
   * @notice Get the corresponding matched order
   *
   * @param _orderID The ID of the order to find of the match of
   * @return matchedOrderID The ID of the matched order
   * @return matchedTraderID the ID of the matched order's trader
   */
  function getMatchedOrder(bytes32 _orderID) onlyClosedOrder(_orderID) public view returns (bytes32 matchedOrderID, bytes20 matchedTraderID) {
    bytes32 matchID = orderMatch[_orderID];
    if (_orderID == matches[matchID].orderID1) {
      matchedOrderID = matches[matchID].orderID2;
    } else if (_orderID == matches[matchID].orderID2) {
      matchedOrderID = matches[matchID].orderID1;
    } else {
      revert();
    }

    matchedTraderID = orders[matchedOrderID].traderID;

    // Not necessary
    return (matchedOrderID, matchedTraderID);
  }
}