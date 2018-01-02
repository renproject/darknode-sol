pragma solidity ^0.4.18;

import "./Ren.sol";

contract OrderBook {
	uint8 public orderLimit = 100;
	uint32 public orderFee = 100000;

  uint8 public tax = 10; // Percentange

  RepublicToken republicToken;
  address taxMan;
  uint poolCount = 10;
  uint kValue = 5;

	uint8 constant statusOpen = 1;
	uint8 constant statusExpired = 2;
	uint8 constant statusClosed = 3;

  struct Output {
    uint fragment;
    bytes zkCommitment;
    bytes32 minerID;
  }

	struct Order {
		uint8 status;
    uint fee;
    mapping (bytes32 => bytes32) delegates;
    Output[] outputs;
    uint registrationTime;
	}

	mapping (bytes32 => Order) public orders;
	mapping (bytes32 => address) owner;
  mapping (address => uint) orderCount;
  mapping (address => bool) registered;
  mapping (bytes32 => uint) reward;

  modifier onlyRegistered() {
    require(registered[msg.sender]);
    _;
  }

  /// @notice Constructor of the contract OrderBook
	/// @param _republicToken The address of the REN token contract
  function OrderBook(address _republicToken, address _taxMan) public {
    republicToken = RepublicToken(_republicToken);
    taxMan = _taxMan;
  }

	/// @notice Function that is called by the trader to submit an order
	/// @param _orderID The hash of the order
  /// @param _fragments The list of hashes of the fragments
	function submitOrder(bytes32 _orderID, bytes32[] _fragments, bytes32[] _miners) public {

    require(_fragments.length == _miners.length && _miners.length == poolCount);
    require(verifyMiners(_miners));
    require(orderCount[msg.sender] < orderLimit);

    uint orderFee = republicToken.allowance(msg.sender, address(this)) * ((100 - tax)/100);
    orders[_orderID].status = statusOpen;
    orders[_orderID].fee = orderFee;

    for (var i = 0; i < poolCount; i++ ) {
      orders[_orderID].delegates[_fragments[i]] = _miners[i];
    }

    orders[_orderID].registrationTime = now;
    orderCount[msg.sender]++;
    owner[_orderID] = msg.sender;
		OrderPlaced(_orderID);
	}

  function verifyMiners(bytes32[] _miners) returns (bool) {
    bool status = true;
    for (uint i = 0; i < _miners.length && status ; i++) {
      status = status && isRegistered(_miners[i]); 
    }
    return status;
  }

  function isRegistered(bytes32 _miner) internal returns (bool) {
    return true;
  }

  function checkOrder(bytes32 _orderID, bytes32 _fragmentHash, bytes32 _minerID) public pure returns(bool) {
    return (orders[_orderID].delegates[_fragmentHash] == _minerID && orders[_orderID].status == statusOpen);
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
	function closeOrder(bytes32 _orderID, Order[] _orders) internal {
    require();
    orders[_orderID].status = statusClosed;
    orderCount[owner[_orderID]]--;
    for (var i = 0; i < _orders.length; i++) {
      reward[_orders[i].minerID] += orders[_orderID]/_orders.length;
    }
    delete owner[_orderID];
		OrderClosed(_orderID);
	}


  function submitOutputFragment(uint _outputFragment, bytes _zkCommitment, bytes32 _orderID, bytes32 _minerID, bytes32 _inputFragmentHash) {
    require();
    Output output;
    output.fragment = _outputFragment;
    output.zkCommitment = _zkCommitment;
    output.minerID = _minerID;
    orders[_orderID].outputs.push(output);
    if (orders[_orderID].outputs.length == kValue) {
      closeOrder(_orderID, orders[_orderID].outputs);
    }
  }

  // function withdrawReward(bytes32 minerID) public {
  //   require(minerID == miner[msg.sender]);
  //   republicToken.transfer(msg.sender, reward[minerID]);
  // }

  function contestResult(bytes32 _orderID, uint _index) onlyRegistered public {
    
  }

  function getOutput(bytes32 _orderID) public constant returns(bytes32[]) {
    require(orders[_orderID].status == statusClosed);
    bytes32[] storage outputFragments;
    for (var i = 0; i < orders[_orderID].outputs.length; i++) {
      outputFragments.push(orders[_orderID].outputs[i].fragment);
    }
    return outputFragments;
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