pragma solidity ^0.5.8;

import "../libraries/Claimable.sol";
import "./ERC20Shifted.sol";

import "../libraries/LinkedList.sol";

/// @notice ShifterRegistry is a mapping from assets to their associated
/// ERC20Shifted and Shifter contracts.
contract ShifterRegistry is Claimable {

    /// @dev The symbol is included twice because strings have to be hashed
    /// first in order to be used as a log index/topic.
    event LogShifterRegistered(string _symbol, string indexed _indexedSymbol, address indexed _tokenAddress, address indexed _shifterAddress);
    event LogShifterDeregistered(string _symbol, string indexed _indexedSymbol, address indexed _tokenAddress, address indexed _shifterAddress);

    /// @notice A list of shifter contracts
    LinkedList.List private shifterList;

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
        require(!LinkedList.isInList(shifterList, _shifterAddress), "shifter already registered");
        require(shifterByToken[_tokenAddress] == address(0x0), "token already registered");
        string memory symbol = ERC20Shifted(_tokenAddress).symbol();
        require(tokenBySymbol[symbol] == address(0x0), "symbol already registered");

        // Add to list of shifters
        LinkedList.append(shifterList, _shifterAddress);

        tokenBySymbol[symbol] = _tokenAddress;
        shifterByToken[_tokenAddress] = _shifterAddress;

        emit LogShifterRegistered(symbol, symbol, _tokenAddress, _shifterAddress);
    }

    /// @notice Allows the owner to remove the shifter address for a given
    ///         ERC20shifter token contract.
    ///
    /// @param _symbol The symbol of the token to deregister.
    function removeShifter(string calldata _symbol) external onlyOwner {
        // Look up token address
        address tokenAddress = tokenBySymbol[_symbol];
        require(tokenAddress != address(0x0), "symbol not registered");

        // Look up shifter address
        address shifterAddress = shifterByToken[tokenAddress];

        // Remove token and shifter
        shifterByToken[tokenAddress] = address(0x0);
        tokenBySymbol[_symbol] = address(0x0);
        LinkedList.remove(shifterList, shifterAddress);

        emit LogShifterDeregistered(_symbol, _symbol, tokenAddress, shifterAddress);
    }

    function getShifters(address _start, uint256 _count) external view returns (address[] memory) {
        address[] memory shifters = new address[](_count);

        // Begin with the first node in the list
        uint256 n = 0;
        address next = _start;
        if (next == address(0)) {
            next = LinkedList.begin(shifterList);
        }

        while (n < _count) {
            if (next == address(0)) {
                break;
            }
            shifters[n] = next;
            next = LinkedList.next(shifterList, next);
            n += 1;
        }
        return shifters;
    }

    /// @notice Returns the Shifter address for the given ERC20Shifted token
    ///         contract address.
    ///
    /// @param _tokenAddress The address of the ERC20Shifted token contract.
    function getShifterByToken(address _tokenAddress) external view returns (address) {
        return shifterByToken[_tokenAddress];
    }

    /// @notice Returns the Shifter address for the given ERC20Shifted token
    ///         symbol.
    ///
    /// @param _tokenSymbol The symbol of the ERC20Shifted token contract.
    function getShifterBySymbol(string calldata _tokenSymbol) external view returns (address) {
        return shifterByToken[tokenBySymbol[_tokenSymbol]];
    }

    /// @notice Returns the ERC20Shifted address for the given token symbol.
    ///
    /// @param _tokenSymbol The symbol of the ERC20Shifted token contract to
    ///        lookup.
    function getTokenBySymbol(string calldata _tokenSymbol) external view returns (address) {
        return tokenBySymbol[_tokenSymbol];
    }
}