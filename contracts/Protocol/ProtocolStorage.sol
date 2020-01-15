pragma solidity 0.5.12;

import "../DarknodeRegistry/DarknodeRegistry.sol";
import "../Shifter/ShifterRegistry.sol";

/// @notice ProtocolStorage stores the values used by ProtocolLogic as a
/// separate contract to reduce the risk of memory slots being moved.
contract ProtocolStorage {

    address public owner;

    // NEW STORAGE VALUES SHOULD ONLY BE ADDED TO THE END OF THIS CONTRACT.

    // These are all private so that the getter interfaced can be changed
    // if necessary.

    // DarknodeRegistry also points to RenToken, DarknodeRegistryStore and
    // DarknodePayment, which in turn points to DarknodePaymentStore.
    DarknodeRegistry internal _darknodeRegistry;

    // ShifterRegistry is used to access the Shifters and the shifted tokens.
    ShifterRegistry internal _shifterRegistry;

}
