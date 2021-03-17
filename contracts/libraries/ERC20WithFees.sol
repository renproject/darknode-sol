pragma solidity 0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

library ERC20WithFees {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /// @notice Calls transferFrom on the token, returning the value transferred
    /// after fees.
    function safeTransferFromWithFees(
        IERC20 token,
        address from,
        address to,
        uint256 value
    ) internal returns (uint256) {
        uint256 balancesBefore = token.balanceOf(to);
        token.safeTransferFrom(from, to, value);
        uint256 balancesAfter = token.balanceOf(to);
        return Math.min(value, balancesAfter.sub(balancesBefore));
    }
}
