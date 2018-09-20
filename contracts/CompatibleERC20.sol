pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/math/Math.sol";

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

    /// @notice Calls transfer on the token and reverts if the call fails.
    function safeTransfer(address token, address to, uint256 amount) internal {
        CompatibleERC20(token).transfer(to, amount);
        require(previousReturnValue(), "transfer failed");
    }

    /// @notice Calls transferFrom on the token and reverts if the call fails.
    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        CompatibleERC20(token).transferFrom(from, to, amount);
        require(previousReturnValue(), "transferFrom failed");
    }

    /// @notice Calls approve on the token and reverts if the call fails.
    function safeApprove(address token, address spender, uint256 amount) internal {
        CompatibleERC20(token).approve(spender, amount);
        require(previousReturnValue(), "approve failed");
    }

    /// @notice Calls transferFrom on the token, reverts if the call fails and
    /// returns the value transferred after fees.
    function safeTransferFromWithFees(address token, address from, address to, uint256 amount) internal returns (uint256) {
        uint256 balancesBefore = CompatibleERC20(token).balanceOf(to);
        CompatibleERC20(token).transferFrom(from, to, amount);
        require(previousReturnValue(), "transferFrom failed");
        uint256 balancesAfter = CompatibleERC20(token).balanceOf(to);
        return Math.min256(amount, balancesAfter.sub(balancesBefore));
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
                returndatacopy(0x0, 0x0, 32)

                // Load  the return data into returnData
                returnData := mload(0x0)
            }

            // Other return size: return false
            default { }
        }

        return returnData != 0;
    }
}

/// @notice ERC20 interface which doesn't specify the return type for transfer,
/// transferFrom and approve.
interface CompatibleERC20 {
    // Modified to not return boolean
    function transfer(address to, uint256 value) external;
    function transferFrom(address from, address to, uint256 value) external;
    function approve(address spender, uint256 value) external;

    // Not modifier
    function totalSupply() external view returns (uint256);
    function balanceOf(address who) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
