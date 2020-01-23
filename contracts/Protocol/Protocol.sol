pragma solidity 0.5.12;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "../DarknodePayment/DarknodePayment.sol";
import "../DarknodePayment/DarknodePaymentStore.sol";
import "../DarknodeRegistry/DarknodeRegistry.sol";
import "../DarknodeRegistry/DarknodeRegistryStore.sol";
import "../DarknodeSlasher/DarknodeSlasher.sol";
import "../RenToken/RenToken.sol";
import "../Shifter/Shifter.sol";
import "../Shifter/ShifterRegistry.sol";
import "./ProtocolStorage.sol";

/// @notice Protocol implements the getter functions for the ProtocolProxy
/// as well as onlyOwner functions for updating the values in ProtocolStorage.
contract Protocol is Initializable, ProtocolStorage {

    // Ownership - Ownable.sol seems to no longer have the `initialize` option.

    modifier onlyOwner() {
         require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    // The `initializer` modifier restricts this to being called only once.
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

    function darknodeRegistryStore() public view returns (DarknodeRegistryStore) {
        return darknodeRegistry().store();
    }

    function renToken() public view returns (RenToken) {
        return darknodeRegistry().ren();
    }

    function darknodePayment() public view returns (DarknodePayment) {
        return DarknodePayment(_payableAddress(address(darknodeRegistry().darknodePayment())));
    }

    function darknodePaymentStore() public view returns (DarknodePaymentStore) {
        return darknodePayment().store();
    }

    function darknodeSlasher() public view returns (DarknodeSlasher) {
        return DarknodeSlasher(_payableAddress(address(darknodeRegistry().slasher())));
    }

    // Shifter contracts

    function shifterRegistry() public view returns (ShifterRegistry) {
        return ProtocolStorage._shifterRegistry;
    }

    function getShifters(address _start, uint256 _count) external view returns (address[] memory) {
        return shifterRegistry().getShifters(_start, _count);
    }

    function getShiftedTokens(address _start, uint256 _count) external view returns (address[] memory) {
        return shifterRegistry().getShiftedTokens(_start, _count);
    }

    function getShifterByToken(address _tokenAddress) external view returns (IShifter) {
        return shifterRegistry().getShifterByToken(_tokenAddress);
    }

    function getShifterBySymbol(string calldata _tokenSymbol) external view returns (IShifter) {
        return shifterRegistry().getShifterBySymbol(_tokenSymbol);
    }

    function getTokenBySymbol(string calldata _tokenSymbol) external view returns (address) {
        return shifterRegistry().getTokenBySymbol(_tokenSymbol);
    }

    // Only owner //////////////////////////////////////////////////////////////

    /// @notice Update the address of DarknodeRegistry. This could affect the
    /// addresses of DarknodeRegistryStore, DarknodePayment,
    /// DarknodePaymentStore and DarknodeSlasher.
    function _updateDarknodeRegistry(DarknodeRegistry _newDarknodeRegistry) public onlyOwner {
        ProtocolStorage._darknodeRegistry = _newDarknodeRegistry;
    }

    /// @notice Update the address of ShifterRegistry. This could affect the
    /// addresses of all of the shifters and shifted tokens.
    function _updateShifterRegistry(ShifterRegistry _newShifterRegistry) public onlyOwner {
        ProtocolStorage._shifterRegistry = _newShifterRegistry;
    }

    // Internal functions //////////////////////////////////////////////////////

    // Cast an address to a payable address.
    function _payableAddress(address a) internal pure returns (address payable) {
        return address(uint160(address(a)));
    }
}
