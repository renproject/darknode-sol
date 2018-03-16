pragma solidity 0.4.18;

/**
 * @notice LinkedList is a library for a circular double linked list.
 */
library LinkedList {

  /*
   * @notice A permanent NULL node (0x0) in the circular double linked list.
   * NULL.next is the head, and NULL.previous is the tail.
   */
  bytes20 private constant NULL = 0x0;

  /**
   * @notice A node points to the node before it, and the node after it. If
   * node.previous = NULL, then the node is the head of the list. If
   * node.next = NULL, then the node is the tail of the list.
   */
  struct Node {
    bool inList;
    bytes20 previous;
    bytes20 next;
  }
  
  /**
   * @notice LinkedList uses a mapping from bytes20s to nodes. Each bytes20
   * uniquely identifies a node, and in this way they are used like pointers.
   */
  struct List {
    mapping (bytes20 => Node) list;
  }

  /**
   * @notice Requires that the node is in the list.
   *
   * @param self The list being used.
   * @param node The node being checked.
   */
  modifier onlyInList(List storage self, bytes20 node) {
    require(isInList(self, node));
    _;
  }

  /**
   * @notice Requires that the node is not in the list.
   *
   * @param self The list being used.
   * @param node The node being checked.
   */
  modifier onlyNotInList(List storage self, bytes20 node) {
    require(!isInList(self, node));
    _;
  }

  function isInList(List storage self, bytes20 node) internal view returns (bool) {
    return self.list[node].inList;
  }

  /**
   * @notice Get the node at the beginning of a double linked list.
   *
   * @param self The list being used.
   *
   * @return A bytes20 identifying the node at the beginning of the double
   * linked list.
   */
  function begin(List storage self) internal view returns (bytes20) {
    return self.list[NULL].next;
  }

  /**
   * @notice Get the node at the end of a double linked list.
   *
   * @param self The list being used.
   *
   * @return A bytes20 identifying the node at the end of the double linked
   * list.
   */
  function end(List storage self) internal view returns (bytes20) {
    return self.list[NULL].previous;
  }

  function next(List storage self, bytes20 node) internal view returns (bytes20) {
    return self.list[node].next;
  }

  function previous(List storage self, bytes20 node) internal view returns (bytes20) {
    return self.list[node].previous;
  }

  /**
   * @notice Insert a new node before an existing node.
   *
   * @param self The list being used.
   * @param target The existing node in the list.
   * @param newNode The next node to insert before the target.
   */
  function insertBefore(List storage self, bytes20 target, bytes20 newNode) internal onlyNotInList(self, newNode) {
    // It is expected that this value is sometimes NULL.
    bytes20 prev = self.list[target].previous;

    self.list[newNode].next = target;
    self.list[newNode].previous = prev;
    self.list[target].previous = newNode;
    self.list[prev].next = newNode;

    self.list[newNode].inList = true;
  }

  /**
   * @notice Insert a new node after an existing node.
   *
   * @param self The list being used.
   * @param target The existing node in the list.
   * @param newNode The next node to insert after the target.
   */
  function insertAfter(List storage self, bytes20 target, bytes20 newNode) internal onlyNotInList(self, newNode) {
    // It is expected that this value is sometimes NULL.
    bytes20 n = self.list[target].next;

    self.list[newNode].previous = target;
    self.list[newNode].next = n;
    self.list[target].next = newNode;
    self.list[n].previous = newNode;

    self.list[newNode].inList = true;
  }
  
  /**
   * @notice Remove a node from the list, and fix the previous and next
   * pointers that are pointing to the removed node. Removing anode that is not
   * in the list will do nothing.
   *
   * @param self The list being using.
   * @param node The node in the list to be removed.
   */
  function remove(List storage self, bytes20 node) internal onlyInList(self, node) {
    if (node == NULL) {
      return;
    }
    bytes20 p = self.list[node].previous;
    bytes20 n = self.list[node].next;

    self.list[p].next = n;
    self.list[n].previous = p;

    // Deleting the node should set this value to false, but we set it here for
    // explicitness.
    self.list[node].inList = false;
    delete self.list[node];
  }

  /**
   * @notice Insert a node at the beginning of the list.
   *
   * @param self The list being used.
   * @param node The node to insert at the beginning of the list.
   */
  function prepend(List storage self, bytes20 node) internal onlyNotInList(self, node) {
    insertBefore(self, begin(self), node);
  }

  /**
   * @notice Insert a node at the end of the list.
   *
   * @param self The list being used.
   * @param node The node to insert at the end of the list.
   */
  function append(List storage self, bytes20 node) internal onlyNotInList(self, node) {
    insertAfter(self, end(self), node);
  }

  function swap(List storage self, bytes20 left, bytes20 right) internal onlyInList(self, left) onlyInList(self, right) {
    bytes20 previousRight = self.list[right].previous;
    remove(self, right);
    insertAfter(self, left, right);
    remove(self, left);
    insertAfter(self, previousRight, left);
  }
}