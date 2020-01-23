pragma solidity 0.5.12;

import "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";

/// @notice Protocol is a directory of the current contract addresses.
/* solium-disable-next-line no-empty-blocks */
contract Protocol is InitializableAdminUpgradeabilityProxy {}
