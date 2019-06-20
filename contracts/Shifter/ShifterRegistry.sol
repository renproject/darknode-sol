pragma solidity ^0.5.8;

import "../libraries/Claimable.sol";
import "./ERC20Shifted.sol";

contract ShifterRegistry is Claimable {
    /// @notice A map of token addresses to canonical shifter addresses
    mapping (address=>address) private shifters;

    /// @notice A map of token symbols to canonical shifter addresses
    mapping (string=>address) private shifterBySymbols;

    /// @notice Allow the owner to update shifter address for a given 
    ///         ERC20Shifted token contract.
    /// @param _tokenAddress The address of the ERC20Shifted token contract.
    /// @param _shifterAddress The address of the Shifter contract.
    function setShifter(ERC20Shifted _tokenAddress, address _shifterAddress) external onlyOwner {
        shifterBySymbols[_tokenAddress.symbol()] = _shifterAddress;
        shifters[_tokenAddress] = _shifterAddress;
    }

    /// @notice Returns the Shifter address for the given ERC20Shifted token
    ///         contract address.
    /// @param _tokenAddress The address of the ERC20Shifted token contract.
    function getShifter(address _tokenAddress) view external returns (address) {
        return shifters[_tokenAddress];
    }

    /// @notice Returns the Shifter address for the given ERC20Shifted token
    ///         symbol.
    /// @param _tokenAddress The address of the ERC20Shifted token contract.
    function getShifterBySymbol(string memory _tokenSymbol) view external returns (address) {
        return shifterBySymbols[_tokenSymbol];
    }
}