pragma solidity 0.5.12;

import "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";

/// @notice ProtocolProxy is a directory of the current contract addresses.
/* solium-disable-next-line no-empty-blocks */
contract ProtocolProxy is InitializableAdminUpgradeabilityProxy {}
