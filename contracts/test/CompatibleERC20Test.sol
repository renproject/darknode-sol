pragma solidity 0.5.6;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import "../CompatibleERC20.sol";

contract CompatibleERC20Test  {
    using SafeMath for uint256;
    using CompatibleERC20Functions for ERC20;

    // Stores its own balance amount
    mapping(address => uint256) public balances;

    function deposit(address _token, uint256 _value) external {
        balances[_token] = ERC20(_token).balanceOf(address(this));

        uint256 newValue = ERC20(_token).safeTransferFromWithFees(msg.sender, address(this), _value);
        balances[_token] = balances[_token].add(newValue);
        require(ERC20(_token).balanceOf(address(this)) == balances[_token], "incorrect balance in deposit");
    }

    function withdraw(address _token, uint256 _value) external {
        balances[_token] = ERC20(_token).balanceOf(address(this));

        ERC20(_token).safeTransfer(msg.sender, _value);
        balances[_token] = balances[_token].sub(_value);
        require(ERC20(_token).balanceOf(address(this)) == balances[_token], "incorrect balance in withdraw");
    }

    function approve(address _token, uint256 _value) external {
        ERC20(_token).safeApprove(msg.sender, _value);
    }

    function naiveDeposit(address _token, uint256 _value) external {
        balances[_token] = ERC20(_token).balanceOf(address(this));

        ERC20(_token).safeTransferFrom(msg.sender, address(this), _value);
        balances[_token] = balances[_token].add(_value);
        require(ERC20(_token).balanceOf(address(this)) == balances[_token], "incorrect balance in deposit");
    }
}
