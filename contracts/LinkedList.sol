pragma solidity ^0.4.18;

library Bytes20List {

  /*
   * @notice Circular doubly linked list with a permanent NULL node (0x0)
   * NULL.next is the head
   * NULL.previous is the tail
   */
  bytes20 private constant NULL = 0x0;

  /**
   * @notice A node points to the node before it and the node after it
   * If node.previous = NULL, then the node is the head of the list
   * If node.next = NULL, then the node is the tail of the list
   */
  struct Node {
    bool inList;
    bytes20 previous;
    bytes20 next;
  }
  
  /**
   * @notice The Linked List is a mapping from bytes20s to nodes
   */
  struct List {
      mapping (bytes20 => Node) list;
  }

  /**
   * @notice Requires that the node is in the list
   * @param self The list being called on
   * @param node The node being checked
   */
  modifier inList(List storage self, bytes20 node) {
    require (isInList(self, node));
    _;
  }

  /**
   * @notice Requires that the node is NOT in the list
   * @param self The list being called on
   * @param node The node being checked
   */
  modifier notInList(List storage self, bytes20 node) {
    require (!isInList(self, node));
    _;
  }

  function isInList(List storage self, bytes20 node) internal view returns (bool) {
    return self.list[node].inList;
  }

  /**
   * @notice Returns the head of the doubly linked list
   * @param self The list being called on
   */
  function head(List storage self) internal view returns (bytes20) {
    return self.list[NULL].next;
  }

  /**
   * @notice Returns the tail of the doubly linked list
   * @param self The list being called on
   */
  function tail(List storage self) internal view returns (bytes20) {
    return self.list[NULL].previous;
  }

  function next(List storage self, bytes20 node) internal view returns (bytes20) {
    return self.list[node].next;
  }

  function previous(List storage self, bytes20 node) internal view returns (bytes20) {
    return self.list[node].previous;
  }

  /**
   * @notice Insert a new node before an existing target node
   * @param self The list being called on
   * @param target The existing node in the list
   * @param newNode The next node to insert before the target
   */
  function insertBefore(List storage self, bytes20 target, bytes20 newNode) internal notInList(self, newNode) {
    // May be NULL
    bytes20 prev = self.list[target].previous;

    self.list[newNode].next = target;
    self.list[newNode].previous = prev;
    self.list[target].previous = newNode;
    self.list[prev].next = newNode;

    self.list[newNode].inList = true;
  }

  /**
   * @notice Insert a new node after an existing target node
   * @param self The list being called on
   * @param target The existing node in the list
   * @param newNode The next node to insert after the target
   */
  function insertAfter(List storage self, bytes20 target, bytes20 newNode) internal notInList(self, newNode) {
    // May be NULL
    bytes20 nxt = self.list[target].next;

    self.list[newNode].previous = target;
    self.list[newNode].next = nxt;
    self.list[target].next = newNode;
    self.list[nxt].previous = newNode;

    self.list[newNode].inList = true;
  }
  
  /**
   * @notice Delete a node
   * @param self The list being called on
   * @param node The existing node in the list to be removed
   */
  function remove(List storage self, bytes20 node) internal inList(self, node) {
    if (node == NULL) {
      return;
    }
    bytes20 prev = self.list[node].previous;
    bytes20 nxt = self.list[node].next;

    self.list[prev].next = nxt;
    self.list[nxt].previous = prev;

    self.list[node].inList = false; // Does `delete` do this already?
    delete self.list[node];
  }

  /**
   * @notice Place a node at the start of the list
   * @param self The list being called on
   * @param newNode The node to insert at the start of the list
   */
  function prepend(List storage self, bytes20 newNode) internal notInList(self, newNode) {
    insertBefore(self, head(self), newNode);
  }

  /**
   * @notice Place a node at the end of the list
   * @param self The list being called on
   * @param newNode The node to insert at the end of the list
   */
  function append(List storage self, bytes20 newNode) internal notInList(self, newNode) {
    insertAfter(self, tail(self), newNode);
  }

  function swap(List storage self, bytes20 node1, bytes20 node2) internal inList(self, node1) inList(self, node2) {
    bytes20 previous2 = self.list[node2].previous;
    remove(self, node2);
    insertAfter(self, node1, node2);
    remove(self, node1);
    insertAfter(self, previous2, node1);
  }
}