pragma solidity 0.5.16;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "../DarknodePayment/DarknodePayment.sol";
import "../DarknodePayment/DarknodePaymentStore.sol";
import "../DarknodeRegistry/DarknodeRegistry.sol";
import "../DarknodeRegistry/DarknodeRegistryStore.sol";
import "../DarknodeSlasher/DarknodeSlasher.sol";
import "../RenToken/RenToken.sol";
import "../Gateway/Gateway.sol";
import "../Gateway/GatewayRegistry.sol";
import "./ProtocolStorage.sol";

/// @notice ProtocolLogic implements the getter functions for the Protocol proxy
/// as well as onlyOwner functions for updating the values in ProtocolStorage.
contract ProtocolLogic is Initializable, ProtocolStorage {
    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    function initialize(address _owner) public initializer {
        owner = _owner;
    }

    function transferOwnership(address _newOwner) public onlyOwner {
        owner = _newOwner;
    }

    // Darknode contracts

    function darknodeRegistry() public view returns (DarknodeRegistry) {
        return ProtocolStorage._darknodeRegistry;
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
        return ProtocolStorage._gatewayRegistry;
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
        returns (address)
    {
        return gatewayRegistry().getTokenBySymbol(_tokenSymbol);
    }

    // Only owner //////////////////////////////////////////////////////////////

    /// @notice Update the address of DarknodeRegistry. This could affect the
    /// addresses of DarknodeRegistryStore, DarknodePayment,
    /// DarknodePaymentStore and DarknodeSlasher.
    function _updateDarknodeRegistry(DarknodeRegistry _newDarknodeRegistry)
        public
        onlyOwner
    {
        ProtocolStorage._darknodeRegistry = _newDarknodeRegistry;
    }

    /// @notice Update the address of GatewayRegistry. This could affect the
    /// addresses of all of the gateways and tokens.
    function _updateGatewayRegistry(GatewayRegistry _newGatewayRegistry)
        public
        onlyOwner
    {
        ProtocolStorage._gatewayRegistry = _newGatewayRegistry;
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
