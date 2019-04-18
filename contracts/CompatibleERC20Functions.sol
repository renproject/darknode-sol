pragma solidity ^0.5.2;


import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/Math.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";

/// @notice Implements safeTransfer, safeTransferFrom and
/// safeApprove for CompatibleERC20.
///
/// See https://github.com/ethereum/solidity/issues/4116
///
/// This library allows interacting with ERC20 tokens that implement any of
/// these interfaces:
///
/// (1) transfer returns true on success, false on failure
/// (2) transfer returns true on success, reverts on failure
/// (3) transfer returns nothing on success, reverts on failure
///
/// Additionally, safeTransferFromWithFees will return the final token
/// value received after accounting for token fees.

library CompatibleERC20Functions {
    using SafeMath for uint256;
    using Address for address;

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    /// @notice Calls transferFrom on the token, reverts if the call fails and
    /// returns the value transferred after fees.
    function safeTransferFromWithFees(IERC20 token, address from, address to, uint256 value) public returns (uint256) {
        uint256 balancesBefore = token.balanceOf(to);
        callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
        require(previousReturnValue(), "transferFrom failed");
        uint256 balancesAfter = token.balanceOf(to);
        return Math.min(value, balancesAfter.sub(balancesBefore));
    }

    function safeApprove(IERC20 token, address spender, uint256 value) internal {
        // safeApprove should only be called when setting an initial allowance,
        // or when resetting it to zero. To increase and decrease it, use
        // 'safeIncreaseAllowance' and 'safeDecreaseAllowance'
        require((value == 0) || (token.allowance(address(this), spender) == 0));
        callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, value));
    }

    function safeIncreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 newAllowance = token.allowance(address(this), spender).add(value);
        callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, newAllowance));
    }

    function safeDecreaseAllowance(IERC20 token, address spender, uint256 value) internal {
        uint256 newAllowance = token.allowance(address(this), spender).sub(value);
        callOptionalReturn(token, abi.encodeWithSelector(token.approve.selector, spender, newAllowance));
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must equal true).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     */
    function callOptionalReturn(IERC20 token, bytes memory data) private {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves.

        // A Solidity high level call has three parts:
        //  1. The target address is checked to verify it contains contract code
        //  2. The call itself is made, and success asserted
        //  3. The return value is decoded, which in turn checks the size of the returned data.

        require(address(token).isContract());

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = address(token).call(data);
        require(success);

        if (returndata.length > 0) { // Return data is optional
            require(abi.decode(returndata, (bool)));
        }
    }

    /// @notice Checks the return value of the previous function. Returns true
    /// if the previous function returned 32 non-zero bytes or returned zero
    /// bytes.
    function previousReturnValue() private pure returns (bool)
    {
        uint256 returnData = 0;

        assembly { /* solium-disable-line security/no-inline-assembly */
            // Switch on the number of bytes returned by the previous call
            switch returndatasize

            // 0 bytes: ERC20 of type (3), did not throw
            case 0 {
                returnData := 1
            }

            // 32 bytes: ERC20 of types (1) or (2)
            case 32 {
                // Copy the return data into scratch space
                returndatacopy(0, 0, 32)

                // Load  the return data into returnData
                returnData := mload(0)
            }

            // Other return size: return false
            default { }
        }

        return returnData != 0;
    }
}
