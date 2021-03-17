pragma solidity 0.5.17;

contract ForceSend {
    function send(address payable recipient) public payable {
        selfdestruct(recipient);
    }
}
