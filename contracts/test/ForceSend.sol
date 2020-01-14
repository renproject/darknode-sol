pragma solidity 0.5.12;

contract ForceSend  {
    function send(address payable recipient) public payable {
        selfdestruct(recipient);
    }
}
