pragma solidity 0.5.12;

import "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";

/// @notice Protocol is a directory of the current contract addresses.
/* solium-disable-next-line no-empty-blocks */
contract Protocol is InitializableAdminUpgradeabilityProxy {
    // uint256 public version;

    // // constructor(address o, address b, bytes memory data) public {
    // //     version = 1;
    // // }

    // function test() public {
    //     version = 2;
    // }

    // function v() public view returns (uint256) {
    //     return version;
    // }
}
