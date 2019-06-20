pragma solidity ^0.5.8;

import "../libraries/Claimable.sol";
import "./ERC20Shifted.sol";

/// @notice ShifterRegistry is a mapping from assets to their associated
/// ERC20Shifted and Shifter contracts.
contract ShifterRegistry is Claimable {

    /// @notice A map of token addresses to canonical shifter addresses
    mapping (address=>address) private shifters;

    /// @notice A map of token symbols to canonical shifter addresses
    mapping (string=>address) private shiftersBySymbols;

    /// @notice Allow the owner to update shifter address for a given
    ///         ERC20Shifted token contract.
    ///
    /// @param _tokenAddress The address of the ERC20Shifted token contract.
    /// @param _shifterAddress The address of the Shifter contract.
    function setShifter(address _tokenAddress, address _shifterAddress) external onlyOwner {
        shiftersBySymbols[ERC20Shifted(_tokenAddress).symbol()] = _shifterAddress;
        shifters[_tokenAddress] = _shifterAddress;
    }

    /// @notice Returns the Shifter address for the given ERC20Shifted token
    ///         contract address.
    ///
    /// @param _tokenAddress The address of the ERC20Shifted token contract.
    function getShifter(address _tokenAddress) external view returns (address) {
        return shifters[_tokenAddress];
    }

    /// @notice Returns the Shifter address for the given ERC20Shifted token
    ///         symbol.
    ///
    /// @param _tokenSymbol The symbol of the ERC20Shifted token contract.
    function getShifterBySymbol(string calldata _tokenSymbol) external view returns (address) {
        return shiftersBySymbols[_tokenSymbol];
    }
}