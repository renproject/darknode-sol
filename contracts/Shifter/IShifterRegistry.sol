pragma solidity 0.5.12;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import "./IShifter.sol";

/// @notice ShifterRegistry is a mapping from assets to their associated
/// ERC20Shifted and Shifter contracts.
interface IShifterRegistry {

    /// @dev The symbol is included twice because strings have to be hashed
    /// first in order to be used as a log index/topic.
    event LogShifterRegistered(string _symbol, string indexed _indexedSymbol, address indexed _tokenAddress, address indexed _shifterAddress);
    event LogShifterDeregistered(string _symbol, string indexed _indexedSymbol, address indexed _tokenAddress, address indexed _shifterAddress);
    event LogShifterUpdated(address indexed _tokenAddress, address indexed _currentShifterAddress, address indexed _newShifterAddress);

    /// @dev To get all the registered shifters use count = 0.
    function getShifters(address _start, uint256 _count) external view returns (IShifter[] memory);

    /// @dev To get all the registered shifted tokens use count = 0.
    function getShiftedTokens(address _start, uint256 _count) external view returns (IERC20[] memory);

    /// @notice Returns the Shifter address for the given ERC20Shifted token
    ///         contract address.
    ///
    /// @param _tokenAddress The address of the ERC20Shifted token contract.
    function getShifterByToken(address _tokenAddress) external view returns (IShifter);

    /// @notice Returns the Shifter address for the given ERC20Shifted token
    ///         symbol.
    ///
    /// @param _tokenSymbol The symbol of the ERC20Shifted token contract.
    function getShifterBySymbol(string calldata _tokenSymbol) external view returns (IShifter);

    /// @notice Returns the ERC20Shifted address for the given token symbol.
    ///
    /// @param _tokenSymbol The symbol of the ERC20Shifted token contract to
    ///        lookup.
    function getTokenBySymbol(string calldata _tokenSymbol) external view returns (IERC20);
}