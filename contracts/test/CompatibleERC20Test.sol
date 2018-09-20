pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../CompatibleERC20.sol";

contract CompatibleERC20Test  {
    using SafeMath for uint256;
    using CompatibleERC20Functions for CompatibleERC20;

    // Stores its own balance amount
    mapping(address => uint256) public balances;

    function deposit(CompatibleERC20 _token, uint256 _value) external {
        balances[_token] = _token.balanceOf(this);

        uint256 newValue = _token.safeTransferFromWithFees(msg.sender, this, _value);
        balances[_token] = balances[_token].add(newValue);
        require(_token.balanceOf(this) == balances[_token], "incorrect balance in deposit");
    }

    function withdraw(CompatibleERC20 _token, uint256 _value) external {
        balances[_token] = _token.balanceOf(this);

        _token.safeTransfer(msg.sender, _value);
        balances[_token] = balances[_token].sub(_value);
        require(_token.balanceOf(this) == balances[_token], "incorrect balance in withdraw");
    }

    function approve(CompatibleERC20 _token, uint256 _value) external {
        _token.safeApprove(msg.sender, _value);
    }

    function naiveDeposit(CompatibleERC20 _token, uint256 _value) external {
        balances[_token] = _token.balanceOf(this);

        _token.safeTransferFrom(msg.sender, this, _value);
        balances[_token] = balances[_token].add(_value);
        require(_token.balanceOf(this) == balances[_token], "incorrect balance in deposit");
    }
}
