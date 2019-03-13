pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./CompatibleERC20.sol";
import "./DarknodeRegistry.sol";

/// @notice DarknodePayment is responsible for paying off darknodes for their computation.
contract DarknodePayment is Ownable {
    using SafeMath for uint256;
    using CompatibleERC20Functions for CompatibleERC20;

    string public VERSION; // Passed in as a constructor parameter.

    address public daiContractAddress; // Passed in as a constructor parameter.

    DarknodeRegistry public darknodeRegistry; // Passed in as a constructor parameter.

    // Mapping from epoch -> address -> hasTicked
    mapping(uint256 => mapping(address => bool)) public darknodeTicks;

    // Mapping from epoch -> totalNumberOfTicks
    mapping(uint256 => uint256) public totalDarknodeTicks;

    uint256 public contractBalance;

    /// @notice Emitted when a payment was made to the contract
    /// @param _payer The address of who made the payment
    /// @param _value The amount of DAI paid to the contract
    event LogPaymentReceived(address _payer, uint256 _value);

    /// @notice Emitted when darknode calls the tick function
    /// @param _darknode The address of the darknode which ticked
    /// @param _epoch The current epoch hash
    /// @param _totalTicks The total number of ticks for this epoch
    event LogDarknodeTick(address _darknode, uint256 _epoch, uint256 _totalTicks);

    /// @notice Only allow registered dark nodes.
    modifier onlyDarknode() {
        require(darknodeRegistry.isRegistered(msg.sender), "not a registered darknode");
        _;
    }

    /// @notice Only allow darknodes which haven't already ticked
    modifier notYetTicked() {
        (uint256 epoch, ) = darknodeRegistry.currentEpoch();
        require(!darknodeTicks[epoch][msg.sender], "already ticked");
        _;
    }

    /// @notice The contract constructor.
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _daiAddress The address of the DAI token contract.
    /// @param _darknodeRegistry The address of the Darknode Registry contract
    constructor(
        string _VERSION,
        address _daiAddress,
        DarknodeRegistry _darknodeRegistry
    ) public {
        VERSION = _VERSION;
        daiContractAddress = _daiAddress;
        darknodeRegistry = _darknodeRegistry;
    }

    /// @notice Deposits DAI into the contract to be paid to the Darknodes
    ///
    /// @param _value The amount of DAI deposit in the token's smallest unit.
    function deposit(uint256 _value) external payable {
        address trader = msg.sender;

        uint256 receivedValue = _value;
        require(msg.value == 0, "unexpected ether transfer");
        receivedValue = CompatibleERC20(daiContractAddress).safeTransferFromWithFees(trader, this, _value);
        privateIncrementBalance(receivedValue);
    }

    /// @notice Sets the darknode as active in order to be paid a portion of fees
    function tick() external onlyDarknode notYetTicked {
        (uint256 epoch, ) = darknodeRegistry.currentEpoch();
        privateSetTick(epoch, msg.sender);
    }

    function privateSetTick(uint256 _epoch, address _darknode) private {
        darknodeTicks[_epoch][_darknode] = true;
        totalDarknodeTicks[_epoch]++;

        emit LogDarknodeTick(_darknode, _epoch, totalDarknodeTicks[_epoch]);
    }

    function privateIncrementBalance(uint256 _value) private {
        contractBalance = contractBalance.add(_value);

        emit LogPaymentReceived(msg.sender, _value);
    }
}
