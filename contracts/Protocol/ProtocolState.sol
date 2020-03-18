pragma solidity 0.5.16;

import "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";

import "../DarknodeRegistry/DarknodeRegistry.sol";
import "../Gateway/GatewayRegistry.sol";

/// @notice ProtocolStateV1 stores the values used by Protocol as a
/// separate contract to reduce the risk of memory slots being moved.
contract ProtocolStateV1 {
    // NEW STORAGE VALUES SHOULD ONLY BE ADDED TO THE END OF THIS CONTRACT.

    // These are all private so that the getter interfaced can be changed
    // if necessary.

    // DarknodeRegistry also points to RenToken, DarknodeRegistryStore and
    // DarknodePayment, which in turn points to DarknodePaymentStore.
    DarknodeRegistry internal _darknodeRegistry;

    // GatewayRegistry is used to access the Gateways and RenERC20s.
    GatewayRegistry internal _gatewayRegistry;
}
