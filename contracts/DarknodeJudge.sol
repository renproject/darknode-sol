pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./DarknodeRegistry.sol";

/// @notice DarknodeJudge is responsible for whitelisting darknodes for rewards
/// and blacklisting darknodes who misbehave
contract DarknodeJudge is Ownable {
    using SafeMath for uint256;

    string public VERSION; // Passed in as a constructor parameter.

    DarknodeRegistry public darknodeRegistry; // Passed in as a constructor parameter.

    address public darknodePayment; // Contract that can call update

    // The current total of whitelisted darknodes
    uint256 public whitelistTotal;

    // The pending number of whitelist darknodes
    uint256 public pendingWhitelist;
    // The pending number of darknodes to be blacklisted
    uint256 public pendingBlacklist;

    // Mapping from address -> isBlacklisted
    mapping(address => bool) public isBlacklisted;

    // Mapping from darknodeAddress -> cycleWhenWhitelisted
    mapping(address => uint256) public darknodeWhitelist;

    /// @notice Emitted when a darknode is blacklisted from receiving rewards
    /// @param _darknode The address of the darknode which was blacklisted
    /// @param _time The time at which the darknode was blacklisted
    event LogDarknodeBlacklisted(address _darknode, uint256 _time);

    /// @notice Emitted when a darknode is unblacklisted from receiving rewards
    /// @param _darknode The address of the darknode which was unblacklisted
    /// @param _time The time at which the darknode was unblacklisted
    event LogDarknodeUnBlacklisted(address _darknode, uint256 _time);

    /// @notice Emitted when a darknode is whitelisted to receive rewards
    /// @param _darknode The address of the darknode which was whitelisted
    /// @param _cycle The cycle in which the darknode was whitelisted
    /// @param _time The time at which the darknode was whitelisted
    event LogDarknodeWhitelisted(address _darknode, uint256 _cycle, uint256 _time);

    /// @notice Emitted when a darknode is updated
    /// @param _total The total number of whitelisted darknodes
    event LogDarknodeWhitelistUpdated(uint256 _total);

    /// @notice Only allow registered dark nodes.
    modifier onlyDarknode(address _addr) {
        require(darknodeRegistry.isRegistered(_addr), "not a registered darknode");
        _;
    }

    /// @notice Only allow the Darknode Payment contract.
    modifier onlyDarknodePayment() {
        require(darknodePayment == msg.sender, "must be darknode payment");
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
    function blacklist(address _addr) external onlyDarknodePayment onlyDarknode(_addr) {
        require(!isBlacklisted[_addr], "already blacklisted");

        if (isWhitelisted(_addr)) {
            pendingBlacklist += 1;
            darknodeWhitelist[_addr] = 0;
        }
        
        isBlacklisted[_addr] = true;

        emit LogDarknodeBlacklisted(_addr, now);
    }

    /// @notice Whitelist a darknode to receive rewards
    ///
    /// @param _addr The darknode to be whitelisted
    /// @param _cycle The cycle in which the darknode was whitelisted
    function whitelist(address _addr, uint256 _cycle) external onlyDarknodePayment onlyDarknode(_addr) {
        require(!isBlacklisted[_addr], "darknode blacklisted");
        require(!isWhitelisted(_addr), "darknode already whitelisted");

        darknodeWhitelist[_addr] = _cycle;
        pendingWhitelist += 1;
        emit LogDarknodeWhitelisted(_addr, _cycle, now);
    }

    /// @notice Updates the total number of whitelisted darknodes
    function update() external onlyDarknodePayment {
        whitelistTotal += (pendingWhitelist - pendingBlacklist);

        pendingWhitelist = 0;
        pendingBlacklist = 0;

        emit LogDarknodeWhitelistUpdated(whitelistTotal);
    }

    /// @notice Removes a blacklisted darknode from the blacklist
    ///
    /// @param _addr The darknode to be unblacklisted
    function unBlacklist(address _addr) external onlyDarknode(_addr) onlyOwner {
        require(isBlacklisted[_addr], "not in blacklist");

        isBlacklisted[_addr] = false;
        emit LogDarknodeUnBlacklisted(_addr, now);
    }

    /// @notice Allow the contract owner to update the DarknodePayment contract
    /// address.
    /// @param _addr The new DarknodePayment contract address.
    function updateDarknodePayment(address _addr) external onlyOwner {
        require(_addr != 0x0, "invalid contract address");
        darknodePayment = _addr;
    }

    /// @notice Checks to see if a darknode is whitelisted
    /// @param _addr The address of the darknode
    /// @return true if the darknode is whitelisted
    function isWhitelisted(address _addr) public view returns (bool) {
        return darknodeWhitelist[_addr] != 0;
    }

}
