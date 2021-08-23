pragma solidity 0.5.17;

import "../Governance/Claimable.sol";
import "./RenERC20.sol";
import "../libraries/LinkedList.sol";
import "./interfaces/IGateway.sol";
import "../libraries/CanReclaimTokens.sol";

/// @notice GatewayRegistry is a mapping from assets to their associated
/// RenERC20 and Gateway contracts.
contract GatewayRegistry is Claimable, CanReclaimTokens {
    constructor() public {
        Claimable.initialize(msg.sender);
        CanReclaimTokens.initialize(msg.sender);
    }

    /// @dev The symbol is included twice because strings have to be hashed
    /// first in order to be used as a log index/topic.
    event LogGatewayRegistered(
        string _symbol,
        string indexed _indexedSymbol,
        address indexed _token,
        address indexed _gatewayContract
    );
    event LogGatewayDeregistered(
        string _symbol,
        string indexed _indexedSymbol,
        address indexed _token,
        address indexed _gatewayContract
    );
    event LogGatewayUpdated(
        address indexed _token,
        address indexed _currentGatewayContract,
        address indexed _newGatewayContract
    );

    /// @notice The number of gateways registered.
    uint256 numGatewayContracts = 0;

    /// @notice A list of gateway contracts.
    LinkedList.List private gatewayContractList;

    /// @notice A list of ren token contracts.
    LinkedList.List private renTokenList;

    /// @notice A map of token addresses to canonical gateway contract addresses.
    mapping(address => address) private gatewayByToken;

    /// @notice A map of token symbols to token addresses.
    mapping(string => address) private tokenBySymbol;

    /// @notice Allow the owner to set the Gateway contract for a given
    ///         RenERC20 token contract.
    ///
    /// @param _token The address of the RenERC20 token contract.
    /// @param _gatewayContract The address of the Gateway contract.
    function setGateway(
        string calldata _symbol,
        address _token,
        address _gatewayContract
    ) external onlyOwner {
        require(
            symbolIsValid(_symbol),
            "GatewayRegistry: symbol must be alphanumeric"
        );

        // Check that token, Gateway and symbol haven't already been registered.
        require(
            !LinkedList.isInList(gatewayContractList, _gatewayContract),
            "GatewayRegistry: gateway already registered"
        );
        require(
            gatewayByToken[_token] == address(0x0),
            "GatewayRegistry: token already registered"
        );
        require(
            tokenBySymbol[_symbol] == address(0x0),
            "GatewayRegistry: symbol already registered"
        );

        // Add to list of gateways.
        LinkedList.append(gatewayContractList, _gatewayContract);

        // Add to list of ren tokens.
        LinkedList.append(renTokenList, _token);

        tokenBySymbol[_symbol] = _token;
        gatewayByToken[_token] = _gatewayContract;
        numGatewayContracts += 1;

        emit LogGatewayRegistered(_symbol, _symbol, _token, _gatewayContract);
    }

    /// @notice Allow the owner to update the Gateway contract for a given
    ///         RenERC20 contract.
    ///
    /// @param _token The address of the RenERC20 contract.
    /// @param _newGatewayContract The updated address of the Gateway contract.
    function updateGateway(address _token, address _newGatewayContract)
        external
        onlyOwner
    {
        // Check that token, Gateway are registered
        address currentGateway = gatewayByToken[_token];
        require(
            currentGateway != address(0x0),
            "GatewayRegistry: token not registered"
        );

        // Remove to list of Gateway contracts.
        LinkedList.remove(gatewayContractList, currentGateway);

        // Add to list of RenERC20 tokens.
        LinkedList.append(gatewayContractList, _newGatewayContract);

        gatewayByToken[_token] = _newGatewayContract;

        emit LogGatewayUpdated(_token, currentGateway, _newGatewayContract);
    }

    /// @notice Allows the owner to remove the Gateway contract for a given
    ///         RenERC20 contract.
    ///
    /// @param _symbol The symbol of the token to deregister.
    function removeGateway(string calldata _symbol) external onlyOwner {
        // Look up token address
        address tokenAddress = tokenBySymbol[_symbol];
        require(
            tokenAddress != address(0x0),
            "GatewayRegistry: symbol not registered"
        );

        // Look up Gateway contract address
        address gatewayAddress = gatewayByToken[tokenAddress];

        // Remove token and Gateway contract
        delete gatewayByToken[tokenAddress];
        delete tokenBySymbol[_symbol];
        LinkedList.remove(gatewayContractList, gatewayAddress);
        LinkedList.remove(renTokenList, tokenAddress);
        numGatewayContracts -= 1;

        emit LogGatewayDeregistered(
            _symbol,
            _symbol,
            tokenAddress,
            gatewayAddress
        );
    }

    /// @dev To get all the registered Gateway contracts use count = 0.
    function getGateways(address _start, uint256 _count)
        external
        view
        returns (address[] memory)
    {
        return
            LinkedList.elements(
                gatewayContractList,
                _start,
                _count == 0 ? numGatewayContracts : _count
            );
    }

    /// @dev To get all the registered RenERC20 tokens use count = 0.
    function getRenTokens(address _start, uint256 _count)
        external
        view
        returns (address[] memory)
    {
        return
            LinkedList.elements(
                renTokenList,
                _start,
                _count == 0 ? numGatewayContracts : _count
            );
    }

    /// @notice Returns the Gateway contract for the given RenERC20 token
    ///         address.
    ///
    /// @param _token The address of the RenERC20 token contract.
    function getGatewayByToken(address _token)
        external
        view
        returns (IGateway)
    {
        return IGateway(gatewayByToken[_token]);
    }

    /// @notice Returns the Gateway contract for the given RenERC20 token
    ///         symbol.
    ///
    /// @param _tokenSymbol The symbol of the RenERC20 token contract.
    function getGatewayBySymbol(string calldata _tokenSymbol)
        external
        view
        returns (IGateway)
    {
        return IGateway(gatewayByToken[tokenBySymbol[_tokenSymbol]]);
    }

    /// @notice Returns the RenERC20 address for the given token symbol.
    ///
    /// @param _tokenSymbol The symbol of the RenERC20 token contract to
    ///        lookup.
    function getTokenBySymbol(string calldata _tokenSymbol)
        external
        view
        returns (IERC20)
    {
        return IERC20(tokenBySymbol[_tokenSymbol]);
    }

    function symbolIsValid(string memory _tokenSymbol)
        public
        pure
        returns (bool)
    {
        for (uint256 i = 0; i < bytes(_tokenSymbol).length; i++) {
            uint8 char = uint8(bytes(_tokenSymbol)[i]);
            if (
                !((char >= 65 && char <= 90) ||
                    (char >= 97 && char <= 122) ||
                    (char >= 48 && char <= 57))
            ) {
                return false;
            }
        }
        return true;
    }
}
