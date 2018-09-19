pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../CompatibleERC20.sol";

contract CompatibleERC20Test  {
    using CompatibleERC20Functions for CompatibleERC20;

    function deposit(CompatibleERC20 _token, uint256 _value) external {
        require(_token.compliantTransferFrom(msg.sender, this, _value), "transferFrom failed");
    }

    function withdraw(CompatibleERC20 _token, uint256 _value) external {
        require(_token.compliantTransfer(msg.sender, _value), "transfer failed");
    }

    function approve(CompatibleERC20 _token, uint256 _value) external {
        require(_token.compliantApprove(msg.sender, _value), "approve failed");
    }
}
