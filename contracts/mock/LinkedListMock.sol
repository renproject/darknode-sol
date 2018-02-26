pragma solidity ^0.4.18;

import "../LinkedList.sol";

/**
 * USED FOR TESTING
 */
 
contract LinkedListMock {
  using Bytes20List for Bytes20List.List;

  Bytes20List.List private list;

  modifier inList(Bytes20List.List storage self, bytes20 node) {
    require (self.list[node].inList);
    _;
  }

  modifier notInList(Bytes20List.List storage self, bytes20 node) {
    require (!self.list[node].inList);
    _;
  }

  function isInList(bytes20 value) public view returns (bool) {
    return list.isInList(value);
  }

  function head() public view returns (bytes20) {
    return list.head();
  }

  function tail() public view returns (bytes20) {
    return list.tail();
  }

  function next(bytes20 node) public view returns (bytes20) {
    return list.next(node);
  }

  function previous(bytes20 node) public view returns (bytes20) {
    return list.previous(node);
  }

  function insertBefore(bytes20 target, bytes20 newNode) public {
    list.insertBefore(target, newNode);
  }

  function insertAfter(bytes20 target, bytes20 newNode) public {
    list.insertAfter(target, newNode);
  }
  
  function remove(bytes20 node) public {
    list.remove(node);
  }

  function prepend(bytes20 newNode) public {
    list.prepend(newNode);
  }

  function append(bytes20 newNode) public {
    list.append(newNode);
  }

  function swap(bytes20 node1, bytes20 node2) public {
    list.swap(node1, node2);
  }

}