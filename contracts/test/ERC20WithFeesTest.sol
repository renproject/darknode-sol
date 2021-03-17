pragma solidity 0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";

import "../libraries/ERC20WithFees.sol";

contract ERC20WithFeesTest {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;
    using ERC20WithFees for ERC20;

    // Stores its own balance amount
    mapping(address => uint256) public balances;

    function deposit(address _token, uint256 _value) external {
        balances[_token] = ERC20(_token).balanceOf(address(this));

        uint256 newValue =
            ERC20(_token).safeTransferFromWithFees(
                msg.sender,
                address(this),
                _value
            );
        balances[_token] = balances[_token].add(newValue);
        require(
            ERC20(_token).balanceOf(address(this)) == balances[_token],
            "ERC20WithFeesTest: incorrect balance in deposit"
        );
    }

    function withdraw(address _token, uint256 _value) external {
        balances[_token] = ERC20(_token).balanceOf(address(this));

        ERC20(_token).safeTransfer(msg.sender, _value);
        balances[_token] = balances[_token].sub(_value);
        require(
            ERC20(_token).balanceOf(address(this)) == balances[_token],
            "ERC20WithFeesTest: incorrect balance in withdraw"
        );
    }

    function approve(address _token, uint256 _value) external {
        ERC20(_token).safeApprove(msg.sender, _value);
    }

    function naiveDeposit(address _token, uint256 _value) external {
        balances[_token] = ERC20(_token).balanceOf(address(this));

        ERC20(_token).safeTransferFrom(msg.sender, address(this), _value);
        balances[_token] = balances[_token].add(_value);
        require(
            ERC20(_token).balanceOf(address(this)) == balances[_token],
            "ERC20WithFeesTest: incorrect balance in deposit"
        );
    }
}
