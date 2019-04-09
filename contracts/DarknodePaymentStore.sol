pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./DarknodePayroll.sol";

/// @notice DarknodePaymentStore is responsible for paying off darknodes for their computation.
contract DarknodePaymentStore is Ownable {
    using SafeMath for uint256;

    string public VERSION; // Passed in as a constructor parameter.

    // Tracks which Darknodes are blacklisted and which ones are whitelisted
    DarknodePayroll public darknodePayroll; // Passed in as a constructor parameter.

    // mapping of darknode -> cycle -> claimed
    mapping(address => mapping(uint256 => bool)) public rewardClaimed;

    /// @notice Only allow darknodes which haven't been blacklisted
    modifier notBlacklisted(address _darknode) {
        require(!darknodePayroll.isBlacklisted(_darknode), "darknode is blacklisted");
        _;
    }

    /// @notice The contract constructor.
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _darknodePayroll The address of the DarknodePayroll contract
    constructor(
        string _VERSION,
        DarknodePayroll _darknodePayroll
    ) public {
        VERSION = _VERSION;
        darknodePayroll = _darknodePayroll;
    }

    /// @notice Withdraw fees earned by a Darknode. The fees will be sent to
    /// the owner of the Darknode.
    ///
    /// @param _darknode The address of the Darknode whose fees are being
    ///        withdrawn. The owner of this Darknode will receive the fees.
    function withdraw(address _darknode, address _token) external {
        darknodePayroll.transfer(_darknode, _token);
    }

    /// @notice Claims the rewards allocated to the darknode last cycle and increments
    /// the darknode balances. Whitelists the darknode if it hasn't already been
    /// whitelisted. If a darknode does not call claim() then the rewards for the previous cycle is lost.
    function claim(address _darknode) external notBlacklisted(_darknode) {
        uint256 fetchedCurrentCycle = darknodePayroll.currentCycle();
        uint256 whitelistedCycle = darknodePayroll.darknodeWhitelist(_darknode);

        if (whitelistedCycle == fetchedCurrentCycle) {
            // Can't claim rewards until next cycle
            return;            
        }

        // The darknode hasn't been whitelisted before
        if (whitelistedCycle == 0) {
            darknodePayroll.whitelist(_darknode);
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
