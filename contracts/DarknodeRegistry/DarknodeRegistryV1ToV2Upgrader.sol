pragma solidity ^0.5.17;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/upgrades/contracts/upgradeability/InitializableAdminUpgradeabilityProxy.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";

import "../Governance/Claimable.sol";
import "./DarknodeRegistry.sol";

import "../Governance/RenProxyAdmin.sol";

contract DarknodeRegistryV1ToV2Upgrader is Ownable {
    RenProxyAdmin renProxyAdmin;
    DarknodeRegistryLogicV1 darknodeRegistryProxy;
    DarknodeRegistryLogicV2 darknodeRegistryLogicV2;
    address previousAdminOwner;
    address previousDarknodeRegistryOwner;

    constructor(
        RenProxyAdmin _renProxyAdmin,
        DarknodeRegistryLogicV1 _darknodeRegistryProxy,
        DarknodeRegistryLogicV2 _darknodeRegistryLogicV2
    ) public {
        Ownable.initialize(msg.sender);
        renProxyAdmin = _renProxyAdmin;
        darknodeRegistryProxy = _darknodeRegistryProxy;
        darknodeRegistryLogicV2 = _darknodeRegistryLogicV2;
        previousAdminOwner = renProxyAdmin.owner();
        previousDarknodeRegistryOwner = darknodeRegistryProxy.owner();
    }

    function upgrade() public onlyOwner {
        // Pre-checks
        uint256 numDarknodes = darknodeRegistryProxy.numDarknodes();
        uint256 numDarknodesNextEpoch = darknodeRegistryProxy
            .numDarknodesNextEpoch();
        uint256 numDarknodesPreviousEpoch = darknodeRegistryProxy
            .numDarknodesPreviousEpoch();
        uint256 minimumBond = darknodeRegistryProxy.minimumBond();
        uint256 minimumPodSize = darknodeRegistryProxy.minimumPodSize();
        uint256 minimumEpochInterval = darknodeRegistryProxy
            .minimumEpochInterval();
        uint256 deregistrationInterval = darknodeRegistryProxy
            .deregistrationInterval();
        RenToken ren = darknodeRegistryProxy.ren();
        DarknodeRegistryStore store = darknodeRegistryProxy.store();
        IDarknodePayment darknodePayment = darknodeRegistryProxy
            .darknodePayment();

        // Claim and update.
        darknodeRegistryProxy.claimOwnership();
        renProxyAdmin.upgrade(
            AdminUpgradeabilityProxy(
                // Cast gateway instance to payable address
                address(uint160(address(darknodeRegistryProxy)))
            ),
            address(darknodeRegistryLogicV2)
        );

        // Post-checks
        require(
            numDarknodes == darknodeRegistryProxy.numDarknodes(),
            "Migrator: expected 'numDarknodes' not to change"
        );
        require(
            numDarknodesNextEpoch ==
                darknodeRegistryProxy.numDarknodesNextEpoch(),
            "Migrator: expected 'numDarknodesNextEpoch' not to change"
        );
        require(
            numDarknodesPreviousEpoch ==
                darknodeRegistryProxy.numDarknodesPreviousEpoch(),
            "Migrator: expected 'numDarknodesPreviousEpoch' not to change"
        );
        require(
            minimumBond == darknodeRegistryProxy.minimumBond(),
            "Migrator: expected 'minimumBond' not to change"
        );
        require(
            minimumPodSize == darknodeRegistryProxy.minimumPodSize(),
            "Migrator: expected 'minimumPodSize' not to change"
        );
        require(
            minimumEpochInterval ==
                darknodeRegistryProxy.minimumEpochInterval(),
            "Migrator: expected 'minimumEpochInterval' not to change"
        );
        require(
            deregistrationInterval ==
                darknodeRegistryProxy.deregistrationInterval(),
            "Migrator: expected 'deregistrationInterval' not to change"
        );
        require(
            ren == darknodeRegistryProxy.ren(),
            "Migrator: expected 'ren' not to change"
        );
        require(
            store == darknodeRegistryProxy.store(),
            "Migrator: expected 'store' not to change"
        );
        require(
            darknodePayment == darknodeRegistryProxy.darknodePayment(),
            "Migrator: expected 'darknodePayment' not to change"
        );

        darknodeRegistryProxy.updateSlasher(IDarknodeSlasher(0x0));
    }

    function recover(
        address _darknodeID,
        address _bondRecipient,
        bytes calldata _signature
    ) external onlyOwner {
        return
            DarknodeRegistryLogicV2(address(darknodeRegistryProxy)).recover(
                _darknodeID,
                _bondRecipient,
                _signature
            );
    }

    function returnDNR() public onlyOwner {
        darknodeRegistryProxy._directTransferOwnership(
            previousDarknodeRegistryOwner
        );
    }

    function returnProxyAdmin() public onlyOwner {
        renProxyAdmin.transferOwnership(previousAdminOwner);
    }
}
