pragma solidity 0.5.12;

import "../libraries/LinkedList.sol";

/// @notice A token that exposes the LinkedList library for testing.
contract LinkedListTest {
    using LinkedList for LinkedList.List;

    LinkedList.List private ll;

    function isInList(address node) public view returns (bool) {
        return ll.isInList(node);
    }

    function next(address node) public view returns (address) {
        return ll.next(node);
    }

    function previous(address node) public view returns (address) {
        return ll.previous(node);
    }

    function begin() public view returns (address) {
        return ll.begin();
    }

    function end() public view returns (address) {
        return ll.end();
    }

    function insertBefore(address target, address newNode) public {
        ll.insertBefore(target, newNode);
    }

    function insertAfter(address target, address newNode) public {
        ll.insertAfter(target, newNode);
    }

    function remove(address node) public {
        ll.remove(node);
    }

    function prepend(address newNode) public {
        ll.prepend(newNode);
    }

    function append(address newNode) public {
        ll.append(newNode);
    }

    function swap(address node1, address node2) public {
        ll.swap(node1, node2);
    }

    function elements(address _start, uint256 _count) public view returns(address[] memory) {
        return ll.elements(_start, _count);
    }
}