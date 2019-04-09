pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./DarknodeRegistry.sol";
import "./DarknodePayroll.sol";

/// @notice DarknodePayment is responsible for paying off darknodes for their computation.
contract DarknodePayment is Ownable {
    using SafeMath for uint256;

    string public VERSION; // Passed in as a constructor parameter.

    DarknodeRegistry public darknodeRegistry; // Passed in as a constructor parameter.

    // Tracks which Darknodes are blacklisted and which ones are whitelisted
    DarknodePayroll public darknodePayroll; // Passed in as a constructor parameter.

    // mapping of darknode -> cycle -> claimed
    mapping(address => mapping(uint256 => bool)) public rewardClaimed;

    /// @notice Only allow registered dark nodes.
    modifier onlyDarknode(address _darknode) {
        require(darknodeRegistry.isRegistered(_darknode), "not a registered darknode");
        _;
    }

    /// @notice Only allow darknodes which haven't been blacklisted
    modifier notBlacklisted(address _darknode) {
        require(!darknodePayroll.isBlacklisted(_darknode), "darknode is blacklisted");
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
        DarknodeRegistry _darknodeRegistry,
        DarknodePayroll _darknodePayroll
    ) public {
        VERSION = _VERSION;
        darknodeRegistry = _darknodeRegistry;
        darknodePayroll = _darknodePayroll;
    }

    /// @notice Withdraw fees earned by a Darknode. The fees will be sent to
    /// the owner of the Darknode.
    ///
    /// @param _darknode The address of the Darknode whose fees are being
    ///        withdrawn. The owner of this Darknode will receive the fees.

    function withdraw(address _darknode, address _token) public {
        darknodePayroll.transfer(_darknode, _token);
    }

    /// @notice Claims the rewards allocated to the darknode last cycle and increments
    /// the darknode balances. Whitelists the darknode if it hasn't already been
    /// whitelisted. If a darknode does not call claim() then the rewards for the previous cycle is lost.
    function claim(address _darknode) external onlyDarknode(_darknode) notBlacklisted(_darknode) {
        uint256 fetchedCurrentCycle = darknodePayroll.currentCycle();
        uint256 whitelistedCycle = darknodePayroll.darknodeWhitelist(_darknode);

        if (whitelistedCycle == fetchedCurrentCycle) {
            // Can't claim rewards until next cycle
            return;            
        }

        // The darknode hasn't been whitelisted before
        if (whitelistedCycle == 0) {
            darknodePayroll.darknodeWhitelist(_darknode);
            return;
        }

        // Claim share of rewards allocated for last cycle
        _claimDarknodeReward(_darknode);
    }

    function _claimDarknodeReward(address _darknode) private {
        uint256 prevCycle = darknodePayroll.previousCycle();
        require(!rewardClaimed[_darknode][prevCycle], "reward already claimed");
        rewardClaimed[_darknode][prevCycle] = true;
        darknodePayroll.claim(_darknode);
    }

}
