pragma solidity ^0.5.8;

import "../libraries/Claimable.sol";

contract ShifterRegistry is Claimable {
    /// @notice A map of tokens to canonical shifter addresses
    mapping (address=>address) private shifters;

    /// @notice Allow the owner to update shifter address for a given 
    ///         ERC20Shifted token contract.
    /// @param _tokenAddress The address of the ERC20Shifted token contract.
    /// @param _shifterAddress The address of the Shifter contract.
    function setShifter(address _tokenAddress, address _shifterAddress) external onlyOwner {
        shifters[_tokenAddress] = _shifterAddress;
    }

    /// @notice Returns the Shifter address for the given ERC20Shifted token
    ///         contract address.
    /// @param _tokenAddress The address of the ERC20Shifted token contract.
    function getShifter(address _tokenAddress) view external returns (address) {
        return shifters[_tokenAddress];
    }
}