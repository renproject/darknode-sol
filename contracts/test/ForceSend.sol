pragma solidity 0.5.16;

contract ForceSend  {
    function send(address payable recipient) public payable {
        selfdestruct(recipient);
    }
}
