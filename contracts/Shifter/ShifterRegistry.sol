pragma solidity 0.5.12;

import "../libraries/Claimable.sol";
import "./ERC20Shifted.sol";
import "../libraries/LinkedList.sol";
import "./IShifter.sol";
import "../libraries/CanReclaimTokens.sol";

/// @notice ShifterRegistry is a mapping from assets to their associated
/// ERC20Shifted and Shifter contracts.
contract ShifterRegistry is Claimable, CanReclaimTokens {

    /// @dev The symbol is included twice because strings have to be hashed
    /// first in order to be used as a log index/topic.
    event LogShifterRegistered(string _symbol, string indexed _indexedSymbol, address indexed _tokenAddress, address indexed _shifterAddress);
    event LogShifterDeregistered(string _symbol, string indexed _indexedSymbol, address indexed _tokenAddress, address indexed _shifterAddress);
    event LogShifterUpdated(address indexed _tokenAddress, address indexed _currentShifterAddress, address indexed _newShifterAddress);

    /// @notice The number of shifters registered
    uint256 numShifters = 0;

    /// @notice A list of shifter contracts
    LinkedList.List private shifterList;

    /// @notice A list of shifted token contracts
    LinkedList.List private shiftedTokenList;

    /// @notice A map of token addresses to canonical shifter addresses
    mapping (address=>address) private shifterByToken;

    /// @notice A map of token symbols to canonical shifter addresses
    mapping (string=>address) private tokenBySymbol;

    /// @notice Allow the owner to set the shifter address for a given
    ///         ERC20Shifted token contract.
    ///
    /// @param _tokenAddress The address of the ERC20Shifted token contract.
    /// @param _shifterAddress The address of the Shifter contract.
    function setShifter(address _tokenAddress, address _shifterAddress) external onlyOwner {
        // Check that token, shifter and symbol haven't already been registered
        require(!LinkedList.isInList(shifterList, _shifterAddress), "ShifterRegistry: shifter already registered");
        require(shifterByToken[_tokenAddress] == address(0x0), "ShifterRegistry: token already registered");
        string memory symbol = ERC20Shifted(_tokenAddress).symbol();
        require(tokenBySymbol[symbol] == address(0x0), "ShifterRegistry: symbol already registered");

        // Add to list of shifters
        LinkedList.append(shifterList, _shifterAddress);

        // Add to list of shifted tokens
        LinkedList.append(shiftedTokenList, _tokenAddress);

        tokenBySymbol[symbol] = _tokenAddress;
        shifterByToken[_tokenAddress] = _shifterAddress;
        numShifters += 1;

        emit LogShifterRegistered(symbol, symbol, _tokenAddress, _shifterAddress);
    }

    /// @notice Allow the owner to update the shifter address for a given
    ///         ERC20Shifted token contract.
    ///
    /// @param _tokenAddress The address of the ERC20Shifted token contract.
    /// @param _newShifterAddress The updated address of the Shifter contract.
    function updateShifter(address _tokenAddress, address _newShifterAddress) external onlyOwner {
        // Check that token, shifter are registered
        address currentShifter = shifterByToken[_tokenAddress];
        require(currentShifter != address(0x0), "ShifterRegistry: token not registered");

        // Remove to list of shifters
        LinkedList.remove(shifterList, currentShifter);

        // Add to list of shifted tokens
        LinkedList.append(shifterList, _newShifterAddress);

        shifterByToken[_tokenAddress] = _newShifterAddress;

        emit LogShifterUpdated(_tokenAddress, currentShifter, _newShifterAddress);
    }

    /// @notice Allows the owner to remove the shifter address for a given
    ///         ERC20shifter token contract.
    ///
    /// @param _symbol The symbol of the token to deregister.
    function removeShifter(string calldata _symbol) external onlyOwner {
        // Look up token address
        address tokenAddress = tokenBySymbol[_symbol];
        require(tokenAddress != address(0x0), "ShifterRegistry: symbol not registered");

        // Look up shifter address
        address shifterAddress = shifterByToken[tokenAddress];

        // Remove token and shifter
        delete shifterByToken[tokenAddress]; 
        delete tokenBySymbol[_symbol];
        LinkedList.remove(shifterList, shifterAddress);
        LinkedList.remove(shiftedTokenList, tokenAddress);
        numShifters -= 1;

        emit LogShifterDeregistered(_symbol, _symbol, tokenAddress, shifterAddress);
    }

    /// @dev To get all the registered shifters use count = 0.
    function getShifters(address _start, uint256 _count) external view returns (address[] memory) {
        return LinkedList.elements(shifterList, _start, _count == 0 ? numShifters : _count);
    }

    /// @dev To get all the registered shifted tokens use count = 0.
    function getShiftedTokens(address _start, uint256 _count) external view returns (address[] memory) {
        return LinkedList.elements(shiftedTokenList, _start, _count == 0 ? numShifters : _count);
    }

    /// @notice Returns the Shifter address for the given ERC20Shifted token
    ///         contract address.
    ///
    /// @param _tokenAddress The address of the ERC20Shifted token contract.
    function getShifterByToken(address _tokenAddress) external view returns (IShifter) {
        return IShifter(shifterByToken[_tokenAddress]);
    }

    /// @notice Returns the Shifter address for the given ERC20Shifted token
    ///         symbol.
    ///
    /// @param _tokenSymbol The symbol of the ERC20Shifted token contract.
    function getShifterBySymbol(string calldata _tokenSymbol) external view returns (IShifter) {
        return IShifter(shifterByToken[tokenBySymbol[_tokenSymbol]]);
    }

    /// @notice Returns the ERC20Shifted address for the given token symbol.
    ///
    /// @param _tokenSymbol The symbol of the ERC20Shifted token contract to
    ///        lookup.
    function getTokenBySymbol(string calldata _tokenSymbol) external view returns (address) {
        return tokenBySymbol[_tokenSymbol];
    }
}