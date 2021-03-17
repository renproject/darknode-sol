pragma solidity 0.5.17;

/**
 * @notice LinkedList is a library for a circular double linked list.
 */
library LinkedList {
    /*
     * @notice A permanent NULL node (0x0) in the circular double linked list.
     * NULL.next is the head, and NULL.previous is the tail.
     */
    address public constant NULL = address(0);

    /**
     * @notice A node points to the node before it, and the node after it. If
     * node.previous = NULL, then the node is the head of the list. If
     * node.next = NULL, then the node is the tail of the list.
     */
    struct Node {
        bool inList;
        address previous;
        address next;
    }

    /**
     * @notice LinkedList uses a mapping from address to nodes. Each address
     * uniquely identifies a node, and in this way they are used like pointers.
     */
    struct List {
        mapping(address => Node) list;
        uint256 length;
    }

    /**
     * @notice Insert a new node before an existing node.
     *
     * @param self The list being used.
     * @param target The existing node in the list.
     * @param newNode The next node to insert before the target.
     */
    function insertBefore(
        List storage self,
        address target,
        address newNode
    ) internal {
        require(newNode != address(0), "LinkedList: invalid address");
        require(!isInList(self, newNode), "LinkedList: already in list");
        require(
            isInList(self, target) || target == NULL,
            "LinkedList: not in list"
        );

        // It is expected that this value is sometimes NULL.
        address prev = self.list[target].previous;

        self.list[newNode].next = target;
        self.list[newNode].previous = prev;
        self.list[target].previous = newNode;
        self.list[prev].next = newNode;

        self.list[newNode].inList = true;

        self.length += 1;
    }

    /**
     * @notice Insert a new node after an existing node.
     *
     * @param self The list being used.
     * @param target The existing node in the list.
     * @param newNode The next node to insert after the target.
     */
    function insertAfter(
        List storage self,
        address target,
        address newNode
    ) internal {
        require(newNode != address(0), "LinkedList: invalid address");
        require(!isInList(self, newNode), "LinkedList: already in list");
        require(
            isInList(self, target) || target == NULL,
            "LinkedList: not in list"
        );

        // It is expected that this value is sometimes NULL.
        address n = self.list[target].next;

        self.list[newNode].previous = target;
        self.list[newNode].next = n;
        self.list[target].next = newNode;
        self.list[n].previous = newNode;

        self.list[newNode].inList = true;

        self.length += 1;
    }

    /**
     * @notice Remove a node from the list, and fix the previous and next
     * pointers that are pointing to the removed node. Removing anode that is not
     * in the list will do nothing.
     *
     * @param self The list being using.
     * @param node The node in the list to be removed.
     */
    function remove(List storage self, address node) internal {
        require(isInList(self, node), "LinkedList: not in list");

        address p = self.list[node].previous;
        address n = self.list[node].next;

        self.list[p].next = n;
        self.list[n].previous = p;

        // Deleting the node should set this value to false, but we set it here for
        // explicitness.
        self.list[node].inList = false;
        delete self.list[node];

        self.length -= 1;
    }

    /**
     * @notice Insert a node at the beginning of the list.
     *
     * @param self The list being used.
     * @param node The node to insert at the beginning of the list.
     */
    function prepend(List storage self, address node) internal {
        // isInList(node) is checked in insertBefore

        insertBefore(self, begin(self), node);
    }

    /**
     * @notice Insert a node at the end of the list.
     *
     * @param self The list being used.
     * @param node The node to insert at the end of the list.
     */
    function append(List storage self, address node) internal {
        // isInList(node) is checked in insertBefore

        insertAfter(self, end(self), node);
    }

    function swap(
        List storage self,
        address left,
        address right
    ) internal {
        // isInList(left) and isInList(right) are checked in remove

        address previousRight = self.list[right].previous;
        remove(self, right);
        insertAfter(self, left, right);
        remove(self, left);
        insertAfter(self, previousRight, left);
    }

    function isInList(List storage self, address node)
        internal
        view
        returns (bool)
    {
        return self.list[node].inList;
    }

    /**
     * @notice Get the node at the beginning of a double linked list.
     *
     * @param self The list being used.
     *
     * @return A address identifying the node at the beginning of the double
     * linked list.
     */
    function begin(List storage self) internal view returns (address) {
        return self.list[NULL].next;
    }

    /**
     * @notice Get the node at the end of a double linked list.
     *
     * @param self The list being used.
     *
     * @return A address identifying the node at the end of the double linked
     * list.
     */
    function end(List storage self) internal view returns (address) {
        return self.list[NULL].previous;
    }

    function next(List storage self, address node)
        internal
        view
        returns (address)
    {
        require(isInList(self, node), "LinkedList: not in list");
        return self.list[node].next;
    }

    function previous(List storage self, address node)
        internal
        view
        returns (address)
    {
        require(isInList(self, node), "LinkedList: not in list");
        return self.list[node].previous;
    }

    function elements(
        List storage self,
        address _start,
        uint256 _count
    ) internal view returns (address[] memory) {
        require(_count > 0, "LinkedList: invalid count");
        require(
            isInList(self, _start) || _start == address(0),
            "LinkedList: not in list"
        );
        address[] memory elems = new address[](_count);

        // Begin with the first node in the list
        uint256 n = 0;
        address nextItem = _start;
        if (nextItem == address(0)) {
            nextItem = begin(self);
        }

        while (n < _count) {
            if (nextItem == address(0)) {
                break;
            }
            elems[n] = nextItem;
            nextItem = next(self, nextItem);
            n += 1;
        }
        return elems;
    }
}
