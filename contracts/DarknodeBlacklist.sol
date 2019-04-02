pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./DarknodeRegistry.sol";

/// @notice DarknodePayment is responsible for paying off darknodes for their computation.
contract DarknodeBlacklist is Ownable {
    using SafeMath for uint256;

    string public VERSION; // Passed in as a constructor parameter.

    DarknodeRegistry public darknodeRegistry; // Passed in as a constructor parameter.

    // Mapping from address -> isBlacklisted
    mapping(address => bool) public isBlacklisted;

    /// @notice Emitted when a darknode is blacklisted from receiving rewards
    /// @param _darknode The address of the darknode which was blacklisted
    /// @param _time The time at which the darknode was blacklisted
    event LogDarknodeBlacklisted(address _darknode, uint256 _time);

    /// @notice Emitted when a darknode is unblacklisted from receiving rewards
    /// @param _darknode The address of the darknode which was unblacklisted
    /// @param _time The time at which the darknode was unblacklisted
    event LogDarknodeUnBlacklisted(address _darknode, uint256 _time);

    /// @notice Only allow registered dark nodes.
    modifier onlyDarknode(address _addr) {
        require(darknodeRegistry.isRegistered(_addr), "not a registered darknode");
        _;
    }

    /// @notice The contract constructor.
    /// Starts the current cycle using the time of deploy and the current
    /// epoch according to the darknode registry
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _darknodeRegistry The address of the Darknode Registry contract
    constructor(
        string _VERSION,
        DarknodeRegistry _darknodeRegistry
    ) public {
        VERSION = _VERSION;
        darknodeRegistry = _darknodeRegistry;
    }

    /// @notice Blacklists a darknode from receiving rewards
    ///
    /// @param _addr The darknode to be blacklisted
    function blacklist(address _addr) external onlyDarknode(_addr) onlyOwner {
        require(!isBlacklisted[_addr], "already blacklisted");

        isBlacklisted[_addr] = true;
        emit LogDarknodeBlacklisted(_addr, now);
    }

    /// @notice Removes a blacklisted darknode from the blacklist
    ///
    /// @param _addr The darknode to be unblacklisted
    function unBlacklist(address _addr) external onlyDarknode(_addr) onlyOwner {
        require(isBlacklisted[_addr], "not in blacklist");

        isBlacklisted[_addr] = false;
        emit LogDarknodeUnBlacklisted(_addr, now);
    }

}
