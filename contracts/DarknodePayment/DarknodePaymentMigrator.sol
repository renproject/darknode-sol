pragma solidity 0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";

import "../Governance/Claimable.sol";
import "./DarknodePaymentStore.sol";
import "./DarknodePayment.sol";

/// @notice The DarknodePaymentMigrator migrates unclaimed funds from the
/// DarknodePayment contract. In a single transaction, it claims the store
/// ownership from the DNP contract, migrates unclaimed fees and then returns
/// the store ownership back to the DNP.
contract DarknodePaymentMigrator is Claimable {
    DarknodePayment public dnp;
    address[] public tokens;

    constructor(DarknodePayment _dnp, address[] memory _tokens) public {
        Claimable.initialize(msg.sender);
        dnp = _dnp;
        tokens = _tokens;
    }

    function claimStoreOwnership() external {
        require(msg.sender == address(dnp), "Not darknode payment contract");
        DarknodePaymentStore store = dnp.store();

        store.claimOwnership();

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];

            uint256 unclaimed = store.availableBalance(token);

            store.incrementDarknodeBalance(address(0x0), token, unclaimed);

            store.transfer(
                address(0x0),
                token,
                unclaimed,
                _payableAddress(owner())
            );
        }

        store.transferOwnership(address(dnp));
        dnp.claimStoreOwnership();

        require(
            store.owner() == address(dnp),
            "Store ownership not transferred back."
        );
    }

    // Cast an address to a payable address
    function _payableAddress(address a)
        internal
        pure
        returns (address payable)
    {
        return address(uint160(address(a)));
    }
}
