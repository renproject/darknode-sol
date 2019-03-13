pragma solidity ^0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./CompatibleERC20.sol";

/// @notice DarknodePayment is responsible for paying off darknodes for their computation.
contract DarknodePayment is Ownable {
    using SafeMath for uint256;
    using CompatibleERC20Functions for CompatibleERC20;

    string public VERSION; // Passed in as a constructor parameter.

    address public daiContractAddress; // Passed in as a constructor parameter.

    /// @notice Emitted when a payment was made to the contract
    /// @param _payer The address of who made the payment
    /// @param _value The amount of DAI paid to the contract
    event LogPaymentReceived(address _payer, uint256 _value);

    uint256 public contractBalance;

    /// @notice The contract constructor.
    ///
    /// @param _VERSION A string defining the contract version.
    /// @param _daiAddress The address of the DAI token contract.
    constructor(
        string _VERSION,
        address _daiAddress
    ) public {
        VERSION = _VERSION;

        daiContractAddress = _daiAddress;
        contractBalance = 0;
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



    function privateIncrementBalance(uint256 _value) private {
        contractBalance = contractBalance.add(_value);

        emit LogPaymentReceived(msg.sender, _value);
    }
}
