pragma solidity ^0.4.18;

import "./RepublicToken.sol";
import "./MinerRegistrar.sol";
import "./TraderRegistrar.sol";


/**
 * This contract is still under active development
 */

contract OrderBook {
	uint8 public orderLimit = 100;
	uint32 public minimumOrderFee = 100000;

  RepublicToken republicToken;
  MinerRegistrar minerRegistrar;
  TraderRegistrar traderRegistrar;
  
  uint poolCount;
  uint kValue = 5;

  // TODO: Use enum instead
	uint8 constant STATUS_OPEN = 1;
	uint8 constant STATUS_EXPIRED = 2;
	uint8 constant STATUS_CLOSED = 3;

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

	mapping (bytes32 => Order) public orders;
	mapping (bytes32 => bytes20) owner; // orderID to owner
  mapping (bytes20 => uint) orderCount;
  mapping (bytes32 => uint) reward;

  /**
   * @notice Constructor of the contract OrderBook
	 * @param _republicToken The address of the REN token contract
   * @param _minerRegistrar The address of the miner registrar contract
   * @param _traderRegistrar ...
   */
  function OrderBook(address _republicToken, address _minerRegistrar, address _traderRegistrar) public {
    republicToken = RepublicToken(_republicToken);
    minerRegistrar = MinerRegistrar(_minerRegistrar);
    traderRegistrar = TraderRegistrar(_traderRegistrar);
  }



  /**
  * @notice Open an order
  *
	* @notice Function that is called by the trader to submit an order
	* @param _orderID The hash of the order
  * @param _orderFragmentIDs The list of hashes of the fragments
  * @param _miners ...
  * @param _minerLeaders ...
  */
	function submitOrder(bytes32 _orderID, bytes32[] _orderFragmentIDs, bytes20[] _miners, bytes20[] _minerLeaders) public {

    bytes20 traderID = 9; /* FIXME */
    
    uint256 orderFragmentCount = minerRegistrar.getMNetworkCount();
    require(_orderFragmentIDs.length == _miners.length);
    require(_miners.length == orderFragmentCount);
    require(verifyMiners(_miners));
    require(verifyMiners(_minerLeaders));
    require(orderCount[traderID] < orderLimit);
    
    uint256 fee = republicToken.allowance(msg.sender, address(this));
    require(fee >= minimumOrderFee);
    require(republicToken.transferFrom(msg.sender, address(this), fee));

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
  * TODO: Choose public or private
  */
  function verifyMiners(bytes20[] _miners) private returns (bool) {
    bool status = true;
    for (uint i = 0; i < _miners.length && status; i++) {
      status = status && minerRegistrar.isRegistered(_miners[i]); 
    }
    return status;
  }




  /**
  * TODO: COMMENT ME
  */
  function checkOrder(bytes32 _orderID, bytes20 _minerID, bytes32 _orderFragmentID) public view returns(bool) {
    return true;
    // TODO:
    // return (orders[_orderID].status == STATUS_OPEN && orders[_orderID].minersToOrderFragmentIDs[_minerID] == _orderFragmentID);
  }


	/**
  * @notice Function that is called by the trader to expire an order and refund fees
	* @param _orderID The order data
  */
	function expire(bytes32 _orderID) public {
		require(now - orders[_orderID].timestamp > 2 days);
    orders[_orderID].status = STATUS_EXPIRED;
    orderCount[owner[_orderID]]--;
    // TODO: Get address from republic ID
    // republicToken.transferFrom(address(this), owner[_orderID], orders[_orderID].fee);
    delete owner[_orderID];
		OrderExpired(_orderID);
	}



	/**
   * @notice Function to close a completed order and distribute fees amongst miners
	 * @param _orderID1 The hash for the first order
	 * @param _orderID2 The hash for the matched order
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

	event OrderPlaced(bytes32 _hash, bytes20 _trader);
  event OrderExpired(bytes32 _hash);
	event OrderClosed(bytes32 _hash);
}