pragma solidity ^0.4.0;

contract RenLedger {

    enum Parity {Sell, Buy}

    struct Order{
        uint8 orderType;
        Parity  parity;
        uint256 expiry;
    }

    bytes32[] public orderbook;

    mapping(bytes32 => uint256) public orderPriorities;

    mapping(bytes32 => uint8) public orderStatus;

    mapping(bytes32 => bytes32[]) public orderMatches;

    mapping(bytes32 => Order) public orders;

    mapping(bytes32 => address) public orderOwners;

    function RenLedger(){
        orderbook = new bytes32[](0);
    }

    function OpenOrder(bytes32 orderID, uint8 v, bytes32 r, bytes32 s) public {
        require(ecrecover(orderID, v, r, s) == msg.sender);
        require(orderStatus[orderID] == uint8(0));

        orderbook.push(orderID);
        // what if lots of orders opened at the same time
        // priority = orderbook.length;
        orderPriorities[orderID] = orderbook.length;
        orderStatus[orderID] = uint8(1);
        orderOwners[orderID] = msg.sender;
    }

    function ConfirmOrder(bytes32 orderID, bytes32 counterOrder, uint8 v, bytes32 r, bytes32 s) public{
        require(ecrecover(orderID, v, r, s) == msg.sender);
        require(orderStatus[orderID] == uint8(1));
        require(orderStatus[counterOrder] == uint8(1));

        orderStatus[orderID] = uint8(2);
        orderStatus[counterOrder] = uint8(2);
    }

    function CancelOrder(bytes32 orderID, uint8 v, bytes32 r, bytes32 s) public{
        require(ecrecover(orderID, v, r, s) == msg.sender);
        require(orderStatus[orderID] == uint8(1));
        require(orderOwners[orderID] == msg.sender);

        orderStatus[orderID] = uint8(3);
    }
}
