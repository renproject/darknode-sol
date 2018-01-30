pragma solidity ^0.4.18;


/** Active WIP */


contract Judicar {

  modifier onlyOrderBook() {
    // TODO: require only orderbook can call
    _;
  }

  struct Match {
    bytes32[] zkCommitments;
  }

  mapping (bytes32 => Match) matches;

  function submitCommitment(bytes32 _matchID, bytes32 _zkCommitment) public {
    matches[_matchID].zkCommitments.push(_zkCommitment);
  }

  function getProofs(bytes32 _orderID) public constant returns(bytes32[] r) {
    // require(orders[_orderID].status == STATUS_CLOSED);
    // bytes32[] storage zkCommitments;
    // // TODO: Fix
    // // for (var i = 0; i < orders[_orderID].outputs.length; i++) {
    // //   zkCommitments.push(orders[_orderID].outputs[i].zkCommitment);
    // // }
    // return zkCommitments;
  }

}