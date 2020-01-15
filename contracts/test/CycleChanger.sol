pragma solidity 0.5.12;

import "../DarknodePayment/DarknodePayment.sol";

/// @notice CycleChanger attempts to change the cycle twice in the same block.
contract CycleChanger {

    DarknodePayment public darknodePayment; // Passed in as a constructor parameter.

    /// @notice The contract constructor.
    /// @param _darknodePayment The address of the DarknodePaymentStore contract
    constructor(
        DarknodePayment _darknodePayment
    ) public {
        darknodePayment = _darknodePayment;
    }

    function changeCycle() public {
        darknodePayment.changeCycle();
        darknodePayment.changeCycle();
    }

    function time() public view returns (uint256) {
        return block.timestamp;
    }
}