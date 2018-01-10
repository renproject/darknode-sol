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
    // MatchFragment[] matchFragments;
	}

  // TODO: Use enum instead
	uint8 constant STATUS_OPEN = 1;
	uint8 constant STATUS_EXPIRED = 2;
	uint8 constant STATUS_CLOSED = 3;

	uint8 public orderLimit = 100;
	uint32 public minimumOrderFee = 100000;
  
  uint poolCount;
  uint kValue = 5;

	mapping (bytes32 => Order) public orders;
	mapping (bytes32 => bytes20) owner; // orderID to owner
  mapping (bytes20 => uint) orderCount;
  mapping (bytes32 => uint) reward;

  /** Events */

  event OrderPlaced(bytes32 _hash, bytes20 _trader);
  event OrderExpired(bytes32 _hash);
	event OrderClosed(bytes32 _hash);
  event Debug(string msg);

  /** Private functions */

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

    Debug("....");
    
    uint256 orderFragmentCount = minerRegistrar.getMNetworkSize();
    require(_orderFragmentIDs.length == _miners.length);
    require(_orderFragmentIDs.length == orderFragmentCount);
    require(verifyMiners(_miners));
    require(verifyMiners(_minerLeaders));
    require(orderCount[traderID] < orderLimit);
    
    uint256 fee = ren.allowance(msg.sender, address(this));
    require(fee >= minimumOrderFee);
    require(ren.transferFrom(msg.sender, address(this), fee));

    // MatchFragment[] storage matchFragments;
    // mapping(bytes20 => bytes20) minersToOrderFragmentIDs;
    
    orders[_orderID] = Order({
      orderID: _orderID,
      traderID: traderID,
      
      status: STATUS_OPEN,
      fee: fee,
      timestamp: now,

      orderFragmentCount: orderFragmentCount
      // matchFragments: matchFragments
    });

    for (uint256 i = 0; i < poolCount; i++ ) {
      orders[_orderID].minersToOrderFragmentIDs[_miners[i]] = _orderFragmentIDs[i];
    }

    orderCount[traderID]++;
    owner[_orderID] = traderID;

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
    // republicToken.transferFrom(address(this), owner[_orderID], orders[_orderID].fee);
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
   * @param _matches ...
   */
	function closeOrder(bytes32 _orderID1, bytes32 _orderID2, MatchFragment[] _matches) internal {
    // require();
    uint fee = orders[_orderID1].fee + orders[_orderID2].fee/kValue;
    orders[_orderID1].status = STATUS_CLOSED;
    orders[_orderID2].status = STATUS_CLOSED;
    orderCount[owner[_orderID1]]--;
    orderCount[owner[_orderID2]]--;
    // TODO: reward miners
    // for (var i = 0; i < kValue; i++) {
    //   reward[orders[_matches[i].orderFragmentID1].minerID] += fee;
    // }
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
  function checkOrderFragment(bytes32 _orderID, bytes32 _orderFragmentID, bytes20 _minerID) public view returns(bool) {
    return (orders[_orderID].status == STATUS_OPEN && orders[_orderID].minersToOrderFragmentIDs[_minerID] == _orderFragmentID);
  }

  function getAddress(bytes20 _minerID) internal returns (address) {
    return address(_minerID);
  }

  function submitOutputFragment(bytes _outputFragment, bytes32 _zkCommitment, bytes32 _orderID1, bytes32 _orderID2, bytes20 _minerID, bytes32 _orderFragmentID1, bytes32 _orderFragmentID2) public {
    // TODO: Fix
    // require(orders[_orderID1].miners[_orderFragmentID1] == _minerID || orders[_orderID1].minerLeaders[_orderFragmentID1] == _minerID);
    require(msg.sender == getAddress(_minerID));

    // bytes32 matchID = keccak256(_orderID1,_orderID2);
    MatchFragment storage matchFragment;
    matchFragment.outputFragment = _outputFragment;
    matchFragment.zkCommitment = _zkCommitment;
    matchFragment.minerID = _minerID;
    // TODO: Fix
    // orders[_orderID1].matchFragments[matchID].push(matchFragment);
    // if (orders[_orderID1].matches[matchID].length == kValue && orders[_orderID1].matches[matchID] == orders[_orderID2].matches[matchID]) {
    //   closeOrder(_orderID1, _orderID2, orders[_orderID1].matches[matchID]);
    // }
  }

  // function withdrawReward(bytes32 minerID) public {
  //   require(minerID == miner[msg.sender]);
  //   republicToken.transfer(msg.sender, reward[minerID]);
  // }

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