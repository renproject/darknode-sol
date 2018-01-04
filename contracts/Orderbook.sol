pragma solidity ^0.4.18;

import "./Ren.sol";
import "./Nodes.sol";

contract OrderBook {
	uint8 public orderLimit = 100;
	uint32 public orderFee = 100000;

  uint8 public tax = 10; // Percentange

  RepublicToken republicToken;
  Nodes minerContract;
  address taxMan;
  uint poolCount;
  uint kValue = 5;

	uint8 constant statusOpen = 1;
	uint8 constant statusExpired = 2;
	uint8 constant statusClosed = 3;

  struct MatchFragment {
    uint outputFragment;
    uint orderFragmentID;
    bytes zkCommitment;
    bytes32 minerID;
  }

	struct Order {
		uint8 status;
    uint fee;
    uint256 fragmentCount;
    mapping (address => bool) authorized; 
    mapping (bytes32 => bytes20) miners;
    mapping (bytes32 => bytes20) minerLeaders;
    MatchFragment[] matchFragments;
    bytes32 matchID;
    uint registrationTime;
	}

	mapping (bytes32 => Order) public orders;
	mapping (bytes32 => address) owner; // orderID to owner
  mapping (address => uint) orderCount;
  mapping (address => bool) registered;
  mapping (bytes32 => uint) reward;

  modifier onlyRegistered() {
    require(registered[msg.sender]);
    _;
  }

  /// @notice Constructor of the contract OrderBook
	/// @param _republicToken The address of the REN token contract
  function OrderBook(address _republicToken, address _minerContract, address _taxMan) public {
    republicToken = RepublicToken(_republicToken);
    minerContract = Nodes(_minerContract);
    taxMan = _taxMan;
  }

	/// @notice Function that is called by the trader to submit an order
	/// @param _orderID The hash of the order
  /// @param _fragments The list of hashes of the fragments
	function submitOrder(bytes32 _orderID, bytes32[] _orderFragmentIDs, bytes20[] _miners, bytes20[] _minerLeaders) public {
    uint fragmentCount = minerContract.getPoolCount();
    require(_orderFragmentIDs.length == _miners.length);
    require(_miners.length == fragmentCount);
    require(verifyMiners(_miners));
    require(verifyMiners(_minerLeaders));
    require(orderCount[msg.sender] < orderLimit);

    
    uint orderFee = republicToken.allowance(msg.sender, address(this)) * ((100 - tax)/100);
    orders[_orderID].status = statusOpen;
    orders[_orderID].fee = orderFee;

    for (var i = 0; i < poolCount; i++ ) {
      orders[_orderID].delegates[_fragments[i]] = _miners[i];
    }

    orders[_orderID].registrationTime = now;
    orders[_orderID].fragmentCount = fragmentCount;
    orderCount[msg.sender]++;
    owner[_orderID] = msg.sender;
		OrderPlaced(_orderID);
	}

  function verifyMiners(bytes32[] _miners) returns (bool) {
    bool status = true;
    for (uint i = 0; i < _miners.length && status ; i++) {
      status = status && minerContract.isRegistered(_miners[i]); 
    }
    return status;
  }

  function checkOrder(bytes32 _orderID, bytes32 _orderFragmentID, bytes32 _minerID) public pure returns(bool) {
    return (orders[_orderID].delegates[_orderFragmentID] == _minerID && orders[_orderID].status == statusOpen);
  }


	/// @notice Function that is called by the trader to expire an order and refund fees
	/// @param _data The order data
	function expire(bytes32 _orderID) public {
		require(now - orders[_orderID].registrationTime > 2 days);
    orders[_orderID].status = statusExpired;
    orderCount[owner[_orderID]]--;
    republicToken.transferFrom(address(this), owner[_orderID], orders[_orderID].fee);
    delete owner[_orderID];
		OrderExpired(_orderID);
	}

	/// @notice Function to close a completed order and distribute fees amongst miners
	/// @param _fragment Order fragment
	/// @param _minerID Unique identifier for the miner
	/// @param _orderHash1 The hash for the first order
	/// @param _orderHash2 The hash for the matched order
	function closeOrder(bytes32 _orderID1, bytes32 _orderID2, MatchFragment[] _matches) internal {
    require();
    uint fee = orders[_orderID1].fee + orders[_orderID2].fee/kValue;
    orders[_orderID1].status = statusClosed;
    orders[_orderID2].status = statusClosed;
    orderCount[owner[_orderID1]]--;
    orderCount[owner[_orderID2]]--;
    for (var i = 0; i < kValue; i++) {
      reward[orders[_matches[i]].minerID] += fee;
    }
    delete owner[_orderID1];
    delete owner[_orderID2];
		OrderClosed(_orderID1);
    OrderClosed(_orderID2);
	}

  function getAddress(bytes20 _minerID) internal returns (address) {
    return address(_minerID);
  }

  function submitOutputFragment(uint _outputFragment, bytes _zkCommitment, bytes32 _orderID1, bytes32 _orderID2, bytes32 _minerID, bytes32 _orderFragmentID1, bytes32 _orderFragmentID2) {
    require(orders[_orderID1].miners[_orderFragmentID1] == _minerID || orders[_orderID1].minerLeaders[_orderFragmentID1] == _minerID);
    require(msg.sender == getAddress(_minerID));

    bytes32 MatchID = keccak256(_orderID1,_orderID2);
    MatchFragment matchFragment;
    matchFragment.fragment = _outputFragment;
    matchFragment.zkCommitment = _zkCommitment;
    matchFragment.minerID = _minerID;
    orders[_orderID1].matches[MatchID].push(matchFragment);
    if (orders[_orderID1].matches[MatchID].length == kValue && orders[_orderID1].matches[MatchID] == orders[_orderID2].matches[MatchID]) {
      closeOrder(_orderID1, _orderID2, orders[_orderID1].matches[MatchID]);
    }
  }

  // function withdrawReward(bytes32 minerID) public {
  //   require(minerID == miner[msg.sender]);
  //   republicToken.transfer(msg.sender, reward[minerID]);
  // }

  function contestResult(bytes32 _orderID, uint _index) onlyRegistered public {
    
  }

  function getOutput(bytes32 _orderID) public constant returns(bytes20) {
    require(orders[_orderID].status == statusClosed);
    return owner[orders[_orderID].matchID];
  }

  function getProofs(bytes32 _orderID) public constant returns(bytes[]) {
    require(orders[_orderID].status == statusClosed);
    bytes[] storage zkCommitments;
    for (var i = 0; i < orders[_orderID].outputs.length; i++) {
      zkCommitments.push(orders[_orderID].outputs[i].zkCommitment);
    }
    return zkCommitments;
  }

	event OrderPlaced(bytes32 _hash);
  event OrderExpired(bytes32 _hash);
	event OrderClosed(bytes32 _hash);
}