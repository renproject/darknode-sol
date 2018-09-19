pragma solidity ^0.4.24;

/// @notice Implements compliantTransfer, compliantTransferFrom and
/// compliantApprove for CompatibleERC20.
///
/// See https://github.com/ethereum/solidity/issues/4116
///
/// This library allows interacting with ERC20 tokens that implement any of
/// these interfaces:
///
/// (1) transfer returns true on success, false on failure
/// (2) transfer returns true on success, reverts on failure
/// (3) transfer returns nothing on success, reverts on failure
library CompatibleERC20Functions {

    /// @notice Calls transfer on the token and returns a boolean indicating its
    /// success.
    function compliantTransfer( address token, address to, uint256 amount) internal returns (bool) {
        CompatibleERC20(token).transfer(to, amount);
        return safeCheckSuccess();
    }

    /// @notice Calls transferFrom on the token and returns a boolean indicating
    /// its success.
    function compliantTransferFrom( address token, address from, address to, uint256 amount) internal returns (bool) {
        CompatibleERC20(token).transferFrom(from, to, amount);
        return safeCheckSuccess();
    }

    /// @notice Calls approve on the token and returns a boolean indicating its
    /// success.
    function compliantApprove(address token, address spender, uint256 amount) internal returns (bool) {
        CompatibleERC20(token).approve(spender, amount);
        return safeCheckSuccess();
    }

    /// @notice Checks the return value of the previous function. Returns true
    /// if the previous function returned 32 non-zero bytes or returned zero
    /// bytes.
    function safeCheckSuccess() private pure returns (bool)
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
    function transfer(address to, uint256 value) external;
    function transferFrom(address from, address to, uint256 value) external;
    function approve(address spender, uint256 value) external;
}
