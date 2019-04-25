pragma solidity ^0.5.7;

import "../../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

import "../Claimable.sol";
import "../CompatibleERC20Functions.sol";
import "../DarknodeRegistry/DarknodeRegistry.sol";

/// @notice DarknodePaymentStore is responsible for tracking black/whitelisted
///         darknodes as well as the balances which have been allocated to the
///         darknodes. It is also responsible for holding the tokens to be paid
///         out to darknodes.
contract DarknodePaymentStore is Claimable {
    using SafeMath for uint256;
    using CompatibleERC20Functions for ERC20;

    string public VERSION; // Passed in as a constructor parameter.

    /// @notice The special address for Ether.
    address constant public ETHEREUM = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @notice The size of the whitelist
    uint256 public darknodeWhitelistLength;

    /// @notice Mapping of darknode -> token -> balance
    mapping(address => mapping(address => uint256)) public darknodeBalances;

    /// @notice Mapping of token -> lockedAmount
    mapping(address => uint256) public lockedBalances;

    /// @notice mapping of darknode -> blacklistTimestamp
    mapping(address => uint256) public darknodeBlacklist;

    /// @notice mapping of darknode -> whitelistTimestamp
    mapping(address => uint256) public darknodeWhitelist;

    /// @notice The contract constructor.
    ///
    /// @param _VERSION A string defining the contract version.
    constructor(
        string memory _VERSION
    ) public {
        VERSION = _VERSION;
    }

    /// @notice Allow direct payments to be made to the DarknodePaymentStore.
    function () external payable {
    }

    /// @notice Checks to see if a darknode is blacklisted
    ///
    /// @param _darknode The address of the darknode
    /// @return true if the darknode is blacklisted
    function isBlacklisted(address _darknode) public view returns (bool) {
        return darknodeBlacklist[_darknode] != 0;
    }

    /// @notice Checks to see if a darknode is whitelisted
    ///
    /// @param _darknode The address of the darknode
    /// @return true if the darknode is whitelisted
    function isWhitelisted(address _darknode) public view returns (bool) {
        return darknodeWhitelist[_darknode] != 0;
    }

    /// @notice Get the total balance of the contract for a particular token
    ///
    /// @param _token The token to check balance of
    /// @return The total balance of the contract
    function totalBalance(address _token) public view returns (uint256) {
        if (_token == ETHEREUM) {
            return address(this).balance;
        } else {
            return ERC20(_token).balanceOf(address(this));
        }
    }

    /// @notice Get the available balance of the contract for a particular token
    ///         This is the free amount which has not yet been allocated to
    ///         darknodes.
    ///
    /// @param _token The token to check balance of
    /// @return The available balance of the contract
    function availableBalance(address _token) public view returns (uint256) {
        return totalBalance(_token).sub(lockedBalances[_token]);
    }

    /// @notice Blacklists a darknode from participating in reward allocation.
    ///         If the darknode is whitelisted, it is removed from the whitelist
    ///         and the number of whitelisted nodes is decreased.
    ///
    /// @param _darknode The address of the darknode to blacklist
    function blacklist(address _darknode) external onlyOwner {
        require(!isBlacklisted(_darknode), "darknode already blacklisted");
        darknodeBlacklist[_darknode] = now;

        // Unwhitelist if necessary
        if (isWhitelisted(_darknode)) {
            darknodeWhitelist[_darknode] = 0;
            // Use SafeMath when subtracting to avoid underflows
            darknodeWhitelistLength = darknodeWhitelistLength.sub(1);
        }
    }

    /// @notice Whitelists a darknode allowing it to participate in reward
    ///         allocation.
    ///
    /// @param _darknode The address of the darknode to whitelist
    function whitelist(address _darknode) external onlyOwner {
        require(!isBlacklisted(_darknode), "darknode is blacklisted");
        require(!isWhitelisted(_darknode), "darknode already whitelisted");

        darknodeWhitelist[_darknode] = now;
        darknodeWhitelistLength++;
    }

    /// @notice Increments the amount of funds allocated to a particular
    ///         darknode.
    ///
    /// @param _darknode The address of the darknode to increase balance of
    /// @param _token The token which the balance should be incremented
    /// @param _amount The amount that the balance should be incremented by
    function incrementDarknodeBalance(address _darknode, address _token, uint256 _amount) external onlyOwner {
        require(_amount > 0, "invalid amount");
        require(availableBalance(_token) >= _amount, "insufficient contract balance");

        darknodeBalances[_darknode][_token] = darknodeBalances[_darknode][_token].add(_amount);
        lockedBalances[_token] = lockedBalances[_token].add(_amount);
    }

    /// @notice Transfers an amount out of balance to a specified address
    ///
    /// @param _darknode The address of the darknode
    /// @param _token Which token to transfer
    /// @param _amount The amount to transfer
    /// @param _recipient The address to withdraw it to
    function transfer(address _darknode, address _token, uint256 _amount, address payable _recipient) external onlyOwner {
        require(darknodeBalances[_darknode][_token] >= _amount, "insufficient darknode balance");
        darknodeBalances[_darknode][_token] = darknodeBalances[_darknode][_token].sub(_amount);
        lockedBalances[_token] = lockedBalances[_token].sub(_amount);

        if (_token == ETHEREUM) {
            _recipient.transfer(_amount);
        } else {
            ERC20(_token).safeTransfer(_recipient, _amount);
        }
    }

}
