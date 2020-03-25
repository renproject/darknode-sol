pragma solidity 0.5.16;

import "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";

import "../DarknodeRegistry/DarknodeRegistry.sol";
import "../Gateway/GatewayRegistry.sol";

/**
 *
 * NOTICE: New variables should be added to a new contract ProtocolStateV2,
 * not added to ProtocolStateV1. ProtocolStateV1 should not be changed once
 * the Protocol contract has been deployed. ProtocolLogicV1 should then inherit
 * both ProtocolStateV1 and ProtocolStateV2.
 *
 */

/// @notice ProtocolStateV1 stores the values used by Protocol as a
/// separate contract to reduce the risk of memory slots being moved.
contract ProtocolStateV1 {
    // These are all private so that the getter interfaced can be changed
    // if necessary.

    // DarknodeRegistry also points to RenToken, DarknodeRegistryStore and
    // DarknodePayment, which in turn points to DarknodePaymentStore.
    DarknodeRegistryLogicV1 internal _darknodeRegistry;

    // GatewayRegistry is used to access the Gateways and RenERC20s.
    GatewayRegistry internal _gatewayRegistry;
}
