pragma solidity ^0.4.23;

import "../libraries/LinkedList.sol";

 
contract LinkedListTest {
    using LinkedList for LinkedList.List;

    LinkedList.List private ll;

    function isInList(bytes20 node) public view returns (bool) {
        return ll.isInList(node);
    }

    function next(bytes20 node) public view returns (bytes20) {
        return ll.next(node);
    }

    function previous(bytes20 node) public view returns (bytes20) {
        return ll.previous(node);
    }

    function begin() public view returns (bytes20) {
        return ll.begin();
    }

    function end() public view returns (bytes20) {
        return ll.end();
    }

    function insertBefore(bytes20 target, bytes20 newNode) public {
        ll.insertBefore(target, newNode);
    }

    function insertAfter(bytes20 target, bytes20 newNode) public {
        ll.insertAfter(target, newNode);
    }
    
    function remove(bytes20 node) public {
        ll.remove(node);
    }

    function prepend(bytes20 newNode) public {
        ll.prepend(newNode);
    }

    function append(bytes20 newNode) public {
        ll.append(newNode);
    }

    function swap(bytes20 node1, bytes20 node2) public {
        ll.swap(node1, node2);
    }

}