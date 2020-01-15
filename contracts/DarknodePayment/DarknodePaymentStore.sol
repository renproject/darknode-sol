pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

import "../libraries/Claimable.sol";
import "../libraries/ERC20WithFees.sol";

/// @notice DarknodePaymentStore is responsible for tracking balances which have
///         been allocated to the darknodes. It is also responsible for holding
///         the tokens to be paid out to darknodes.
contract DarknodePaymentStore is Claimable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;
    using ERC20WithFees for ERC20;

    string public VERSION; // Passed in as a constructor parameter.

    /// @notice The special address for Ether.
    address constant public ETHEREUM = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @notice Mapping of darknode -> token -> balance
    mapping(address => mapping(address => uint256)) public darknodeBalances;

    /// @notice Mapping of token -> lockedAmount
    mapping(address => uint256) public lockedBalances;

    /// @notice The contract constructor.
    ///
    /// @param _VERSION A string defining the contract version.
    constructor(
        string memory _VERSION
    ) public {
        VERSION = _VERSION;
    }

    /// @notice Allow direct ETH payments to be made to the DarknodePaymentStore.
    function () external payable {
    }

    /// @notice Get the total balance of the contract for a particular token
    ///
    /// @param _token The token to check balance of
    /// @return The total balance of the contract
    function totalBalance(address _token) public view returns (uint256) {
        if (_token == ETHEREUM) {
            return address(this).balance;
        } else {
            return ERC20(_token).balanceOf(address(this));
        }
    }

    /// @notice Get the available balance of the contract for a particular token
    ///         This is the free amount which has not yet been allocated to
    ///         darknodes.
    ///
    /// @param _token The token to check balance of
    /// @return The available balance of the contract
    function availableBalance(address _token) public view returns (uint256) {
        return totalBalance(_token).sub(lockedBalances[_token]);
    }

    /// @notice Increments the amount of funds allocated to a particular
    ///         darknode.
    ///
    /// @param _darknode The address of the darknode to increase balance of
    /// @param _token The token which the balance should be incremented
    /// @param _amount The amount that the balance should be incremented by
    function incrementDarknodeBalance(address _darknode, address _token, uint256 _amount) external onlyOwner {
        require(_amount > 0, "DarknodePaymentStore: invalid amount");
        require(availableBalance(_token) >= _amount, "DarknodePaymentStore: insufficient contract balance");

        darknodeBalances[_darknode][_token] = darknodeBalances[_darknode][_token].add(_amount);
        lockedBalances[_token] = lockedBalances[_token].add(_amount);
    }

    /// @notice Transfers an amount out of balance to a specified address
    ///
    /// @param _darknode The address of the darknode
    /// @param _token Which token to transfer
    /// @param _amount The amount to transfer
    /// @param _recipient The address to withdraw it to
    function transfer(address _darknode, address _token, uint256 _amount, address payable _recipient) external onlyOwner {
        require(darknodeBalances[_darknode][_token] >= _amount, "DarknodePaymentStore: insufficient darknode balance");
        darknodeBalances[_darknode][_token] = darknodeBalances[_darknode][_token].sub(_amount);
        lockedBalances[_token] = lockedBalances[_token].sub(_amount);

        if (_token == ETHEREUM) {
            _recipient.transfer(_amount);
        } else {
            ERC20(_token).safeTransfer(_recipient, _amount);
        }
    }

}
