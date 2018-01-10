pragma solidity ^0.4.18;

import "./RepublicToken.sol";

contract OrderBook {
	// uint8 public orderLimit = 100;
	// uint32 public minimumOrderFee = 100000;

  // RepublicToken ren;
  // Nodes minerContract;
  // uint poolCount;
  // uint kValue = 5;

	// uint8 constant STATUS_OPEN = 1;
	// uint8 constant STATUS_EXPIRED = 2;
	// uint8 constant STATUS_CLOSED = 3;

  // struct MatchFragment {
  //   bytes20 minerID;

  //   uint256 orderFragmentID1;
  //   uint256 orderFragmentID2;
  //   uint256 outputFragment;

  //   bytes zkCommitment;
  // }

	// struct Order {
  //   bytes20 orderID;
  //   bytes20 traderID;

	// 	uint8 status;
  //   uint256 fee;
  //   uint256 timestamp;

  //   uint256 orderFragmentCount;
  //   mapping (bytes20 => bytes20) minersToOrderFragmentIDs;
  //   MatchFragment[] matchFragments;
	// }

	// mapping (bytes32 => Order) public orders;
	// mapping (bytes32 => address) owner; // orderID to owner
  // mapping (address => uint) orderCount;
  // mapping (bytes32 => uint) reward;

  // /// @notice Constructor of the contract OrderBook
	// /// @param _ren The address of the REN token contract
  // function OrderBook(address _ren, address _minerContract) public {
  //   ren = ren(_ren);
  //   minerContract = Nodes(_minerContract);
  // }

  // /// @notice Open an order

	// /// @notice Function that is called by the trader to submit an order
	// /// @param _orderID The hash of the order
  // /// @param _fragments The list of hashes of the fragments
	// function submitOrder(bytes32 _orderID, bytes32[] _orderFragmentIDs, bytes20[] _miners, bytes20[] _minerLeaders) public {

  //   bytes20 traderID = 9; /* FIXME */
    
  //   uint256 orderFragmentCount = minerContract.getPoolCount();
  //   require(_orderFragmentIDs.length == _miners.length);
  //   require(_miners.length == orderFragmentCount);
  //   require(verifyMiners(_miners));
  //   require(verifyMiners(_minerLeaders));
  //   require(orderCount[traderID] < orderLimit);
    
  //   uint256 fee = ren.allowance(msg.sender, address(this));
  //   require(fee >= minimumOrderFee);
  //   require(ren.transferFrom(msg.sender, address(this), fee));
    
  //   orders[_orderID] = new Order({
  //     orderID: _orderID,
  //     traderID: traderID,
      
  //     status: STATUS_OPEN,
  //     fee: fee,
  //     timestamp: now,

  //     orderFragmentCount: orderFragmentCount
  //   });

  //   for (uint256 i = 0; i < poolCount; i++ ) {
  //     orders[_orderID].minersToOrderFragmentIDs[_miners[i]] = _orderFragmentIDs[i];
  //   }

  //   orderCount[traderID]++;
  //   owner[_orderID] = traderID;

	// 	OrderPlaced(_orderID, traderID);
	// }

  // function verifyMiners(bytes20[] _miners) returns (bool) {
  //   bool status = true;
  //   for (uint i = 0; i < _miners.length && status; i++) {
  //     status = status && minerContract.isRegistered(_miners[i]); 
  //   }
  //   return status;
  // }







  // /* COMMENT ME */
  // function checkOrder(bytes32 _orderID, bytes32 _minerID, bytes32 _orderFragmentID) public pure returns(bool) {
  //   return (orders[_orderID].status == STATUS_OPEN && orders[_orderID].minersToOrderFragmentIDs[_minerID] == _orderFragmentID);
  // }


	// /// @notice Function that is called by the trader to expire an order and refund fees
	// /// @param _data The order data
	// function expire(bytes32 _orderID) public {
	// 	require(now - orders[_orderID].registrationTime > 2 days);
  //   orders[_orderID].status = statusExpired;
  //   orderCount[owner[_orderID]]--;
  //   ren.transferFrom(address(this), owner[_orderID], orders[_orderID].fee);
  //   delete owner[_orderID];
	// 	OrderExpired(_orderID);
	// }

	// /// @notice Function to close a completed order and distribute fees amongst miners
	// /// @param _fragment Order fragment
	// /// @param _minerID Unique identifier for the miner
	// /// @param _orderHash1 The hash for the first order
	// /// @param _orderHash2 The hash for the matched order
	// function closeOrder(bytes32 _orderID1, bytes32 _orderID2, MatchFragment[] _matches) internal {
  //   require();
  //   uint fee = orders[_orderID1].fee + orders[_orderID2].fee/kValue;
  //   orders[_orderID1].status = statusClosed;
  //   orders[_orderID2].status = statusClosed;
  //   orderCount[owner[_orderID1]]--;
  //   orderCount[owner[_orderID2]]--;
  //   for (var i = 0; i < kValue; i++) {
  //     reward[orders[_matches[i]].minerID] += fee;
  //   }
  //   delete owner[_orderID1];
  //   delete owner[_orderID2];
	// 	OrderClosed(_orderID1);
  //   OrderClosed(_orderID2);
	// }

  // function getAddress(bytes20 _minerID) internal returns (address) {
  //   return address(_minerID);
  // }

  // function submitOutputFragment(uint _outputFragment, bytes _zkCommitment, bytes32 _orderID1, bytes32 _orderID2, bytes32 _minerID, bytes32 _orderFragmentID1, bytes32 _orderFragmentID2) {
  //   require(orders[_orderID1].miners[_orderFragmentID1] == _minerID || orders[_orderID1].minerLeaders[_orderFragmentID1] == _minerID);
  //   require(msg.sender == getAddress(_minerID));

  //   bytes32 MatchID = keccak256(_orderID1,_orderID2);
  //   MatchFragment matchFragment;
  //   matchFragment.fragment = _outputFragment;
  //   matchFragment.zkCommitment = _zkCommitment;
  //   matchFragment.minerID = _minerID;
  //   orders[_orderID1].matches[MatchID].push(matchFragment);
  //   if (orders[_orderID1].matches[MatchID].length == kValue && orders[_orderID1].matches[MatchID] == orders[_orderID2].matches[MatchID]) {
  //     closeOrder(_orderID1, _orderID2, orders[_orderID1].matches[MatchID]);
  //   }
  // }

  // // function withdrawReward(bytes32 minerID) public {
  // //   require(minerID == miner[msg.sender]);
  // //   ren.transfer(msg.sender, reward[minerID]);
  // // }

  // function getOutput(bytes32 _orderID) public constant returns(bytes20) {
  //   require(orders[_orderID].status == statusClosed);
  //   return owner[orders[_orderID].matchID];
  // }

  // function getProofs(bytes32 _orderID) public constant returns(bytes[]) {
  //   require(orders[_orderID].status == statusClosed);
  //   bytes[] storage zkCommitments;
  //   for (var i = 0; i < orders[_orderID].outputs.length; i++) {
  //     zkCommitments.push(orders[_orderID].outputs[i].zkCommitment);
  //   }
  //   return zkCommitments;
  // }

	// event OrderPlaced(bytes32 _hash, address _trader);
  // event OrderExpired(bytes32 _hash);
	// event OrderClosed(bytes32 _hash);
}