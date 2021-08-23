pragma solidity 0.5.17;

import "@openzeppelin/upgrades/contracts/upgradeability/ProxyAdmin.sol";

/**
 * @title RenProxyAdmin
 * @dev Proxies restrict the proxy's owner from calling functions from the
 * delegate contract logic. The ProxyAdmin contract allows single account to be
 * the governance address of both the proxy and the delegate contract logic.
 */
/* solium-disable-next-line no-empty-blocks */
contract RenProxyAdmin is ProxyAdmin {

}
