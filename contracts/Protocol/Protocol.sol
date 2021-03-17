pragma solidity 0.5.17;

import "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";

import "../DarknodePayment/DarknodePayment.sol";
import "../DarknodePayment/DarknodePaymentStore.sol";
import "../DarknodeRegistry/DarknodeRegistry.sol";
import "../DarknodeRegistry/DarknodeRegistryStore.sol";
import "../DarknodeSlasher/DarknodeSlasher.sol";
import "../RenToken/RenToken.sol";
import "../Gateway/GatewayRegistry.sol";
import "../Gateway/interfaces/IGatewayRegistry.sol";
import "../Gateway/interfaces/IGateway.sol";
import "../Governance/Claimable.sol";

/// @notice ProtocolStateV1 stores the values used by Protocol as a
/// separate contract to reduce the risk of memory slots being moved.
contract ProtocolStateV1 {
    /**
     *
     * NOTICE: New variables should be added to a new contract ProtocolStateV2,
     * not added to ProtocolStateV1. ProtocolStateV1 should not be changed once
     * the Protocol contract has been deployed. ProtocolLogicV1 should then inherit
     * both ProtocolStateV1 and ProtocolStateV2.
     *
     */

    // These are all private so that the getter interfaced can be changed
    // if necessary.

    // DarknodeRegistry also points to RenToken, DarknodeRegistryStore and
    // DarknodePayment, which in turn points to DarknodePaymentStore.
    DarknodeRegistryLogicV1 internal _darknodeRegistry;

    // GatewayRegistry is used to access the Gateways and RenERC20s.
    GatewayRegistry internal _gatewayRegistry;
}

/// @notice ProtocolLogicV1 implements the getter functions for the Protocol proxy
/// as well as onlyOwner functions for updating the values in ProtocolState.
contract ProtocolLogicV1 is
    Initializable,
    Claimable,
    ProtocolStateV1,
    IGatewayRegistry
{
    function initialize(address _nextOwner) public initializer {
        Claimable.initialize(_nextOwner);
    }

    // Darknode contracts

    function darknodeRegistry() public view returns (DarknodeRegistryLogicV1) {
        return ProtocolStateV1._darknodeRegistry;
    }

    function darknodeRegistryStore()
        public
        view
        returns (DarknodeRegistryStore)
    {
        return darknodeRegistry().store();
    }

    function renToken() public view returns (RenToken) {
        return darknodeRegistry().ren();
    }

    function darknodePayment() public view returns (DarknodePayment) {
        return
            DarknodePayment(
                _payableAddress(address(darknodeRegistry().darknodePayment()))
            );
    }

    function darknodePaymentStore() public view returns (DarknodePaymentStore) {
        return darknodePayment().store();
    }

    function darknodeSlasher() public view returns (DarknodeSlasher) {
        return
            DarknodeSlasher(
                _payableAddress(address(darknodeRegistry().slasher()))
            );
    }

    // Gateway contracts

    function gatewayRegistry() public view returns (GatewayRegistry) {
        return ProtocolStateV1._gatewayRegistry;
    }

    function getGateways(address _start, uint256 _count)
        external
        view
        returns (address[] memory)
    {
        return gatewayRegistry().getGateways(_start, _count);
    }

    function getRenTokens(address _start, uint256 _count)
        external
        view
        returns (address[] memory)
    {
        return gatewayRegistry().getRenTokens(_start, _count);
    }

    function getGatewayByToken(address _tokenAddress)
        external
        view
        returns (IGateway)
    {
        return gatewayRegistry().getGatewayByToken(_tokenAddress);
    }

    function getGatewayBySymbol(string calldata _tokenSymbol)
        external
        view
        returns (IGateway)
    {
        return gatewayRegistry().getGatewayBySymbol(_tokenSymbol);
    }

    function getTokenBySymbol(string calldata _tokenSymbol)
        external
        view
        returns (IERC20)
    {
        return gatewayRegistry().getTokenBySymbol(_tokenSymbol);
    }

    // Only owner //////////////////////////////////////////////////////////////

    /// @notice Update the address of DarknodeRegistry. This could affect the
    /// addresses of DarknodeRegistryStore, DarknodePayment,
    /// DarknodePaymentStore and DarknodeSlasher.
    function _updateDarknodeRegistry(
        DarknodeRegistryLogicV1 _newDarknodeRegistry
    ) public onlyOwner {
        ProtocolStateV1._darknodeRegistry = _newDarknodeRegistry;
    }

    /// @notice Update the address of GatewayRegistry. This could affect the
    /// addresses of all of the gateways and tokens.
    function _updateGatewayRegistry(GatewayRegistry _newGatewayRegistry)
        public
        onlyOwner
    {
        ProtocolStateV1._gatewayRegistry = _newGatewayRegistry;
    }

    // Internal functions //////////////////////////////////////////////////////

    // Cast an address to a payable address
    function _payableAddress(address a)
        internal
        pure
        returns (address payable)
    {
        return address(uint160(address(a)));
    }
}

/// @notice Protocol is a directory of the current contract addresses.
/* solium-disable-next-line no-empty-blocks */
contract ProtocolProxy is InitializableAdminUpgradeabilityProxy {

}
