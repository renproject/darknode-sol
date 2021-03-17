pragma solidity 0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

import "./IGateway.sol";

/// @notice GatewayRegistry is a mapping from assets to their associated
/// RenERC20 and Gateway contracts.
interface IGatewayRegistry {
    /// @dev The symbol is included twice because strings have to be hashed
    /// first in order to be used as a log index/topic.
    event LogGatewayRegistered(
        string _symbol,
        string indexed _indexedSymbol,
        address indexed _tokenAddress,
        address indexed _gatewayAddress
    );
    event LogGatewayDeregistered(
        string _symbol,
        string indexed _indexedSymbol,
        address indexed _tokenAddress,
        address indexed _gatewayAddress
    );
    event LogGatewayUpdated(
        address indexed _tokenAddress,
        address indexed _currentGatewayAddress,
        address indexed _newGatewayAddress
    );

    /// @dev To get all the registered gateways use count = 0.
    function getGateways(address _start, uint256 _count)
        external
        view
        returns (address[] memory);

    /// @dev To get all the registered RenERC20s use count = 0.
    function getRenTokens(address _start, uint256 _count)
        external
        view
        returns (address[] memory);

    /// @notice Returns the Gateway contract for the given RenERC20
    ///         address.
    ///
    /// @param _tokenAddress The address of the RenERC20 contract.
    function getGatewayByToken(address _tokenAddress)
        external
        view
        returns (IGateway);

    /// @notice Returns the Gateway contract for the given RenERC20
    ///         symbol.
    ///
    /// @param _tokenSymbol The symbol of the RenERC20 contract.
    function getGatewayBySymbol(string calldata _tokenSymbol)
        external
        view
        returns (IGateway);

    /// @notice Returns the RenERC20 address for the given token symbol.
    ///
    /// @param _tokenSymbol The symbol of the RenERC20 contract to
    ///        lookup.
    function getTokenBySymbol(string calldata _tokenSymbol)
        external
        view
        returns (IERC20);
}
