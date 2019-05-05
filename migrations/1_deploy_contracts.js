/// <reference types="../test-ts/typings/truffle" />

const CompatibleERC20Functions = artifacts.require("CompatibleERC20Functions");
const RenToken = artifacts.require("RenToken");
const DarknodePayment = artifacts.require("DarknodePayment");
const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");

const config = require("./config.js");

module.exports = async function (deployer, network) {

    const VERSION_STRING = `${network}-${config.VERSION}`;

    let tokens = [];

    if (network.match("kovan")) {
        RenToken.address = "0x2cd647668494c1b15743ab283a0f980d90a87394";
        DarknodeRegistry.address = "0x1C6309618338D0EDf9a7Ea8eA18E060fD323020D";
        DarknodePayment.address = "";
        tokens = [
            "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            "0x2a8368d2a983a0aeae8da0ebc5b7c03a0ea66b37",
            "0xd67256552f93b39ac30083b4b679718a061feae6",
        ];
    } else {
        RenToken.address = "";
        DarknodeRegistry.address = "";
        DarknodePayment.address = "";
    }

    if (!RenToken.address) {
        await deployer.deploy(RenToken);
    }

    /** DARKNODE REGISTRY *****************************************************/
    if (!DarknodeRegistry.address) {
        await deployer.deploy(
            DarknodeRegistryStore,
            VERSION_STRING,
            RenToken.address,
        );

        await deployer.deploy(
            DarknodeRegistry,
            VERSION_STRING,
            RenToken.address,
            DarknodeRegistryStore.address,
            config.MINIMUM_BOND,
            config.MINIMUM_POD_SIZE,
            config.MINIMUM_EPOCH_INTERVAL
        );
        // Initiate ownership transfer of DNR store 
        const darknodeRegistryStore = await DarknodeRegistryStore.at(DarknodeRegistryStore.address);
        await darknodeRegistryStore.transferOwnership(DarknodeRegistry.address);

        // Claim ownership
        const darknodeRegistry = await DarknodeRegistry.at(DarknodeRegistry.address);
        await darknodeRegistry.claimStoreOwnership();

        /** SLASHER **************************************************************/
        await deployer.deploy(
            DarknodeSlasher,
            DarknodeRegistry.address,
        );
        // Update slasher address
        // const darknodeRegistry = await DarknodeRegistry.at(DarknodeRegistry.address);
        await darknodeRegistry.updateSlasher(DarknodeSlasher.address);
    }

    /** DARKNODE PAYMENT ******************************************************/
    if (!DarknodePayment.address) {
        await deployer.deploy(
            DarknodePaymentStore,
            VERSION_STRING,
        );

        // Deploy Darknode Payment
        await deployer.deploy(
            DarknodePayment,
            VERSION_STRING,
            DarknodeRegistry.address,
            DarknodePaymentStore.address,
            0, // Cycle Duration (updated below, after a cycle has been called)
        );

        // Initiate ownership transfer of DarknodePaymentStore
        const darknodePaymentStore = await DarknodePaymentStore.at(DarknodePaymentStore.address);
        await darknodePaymentStore.transferOwnership(DarknodePayment.address);

        // Update DarknodePaymentStore address
        const darknodePayment = await DarknodePayment.at(DarknodePayment.address);
        await darknodePayment.claimStoreOwnership();

        for (const token of tokens) {
            await darknodePayment.registerToken(token);
        }
        await darknodePayment.changeCycle();
        await darknodePayment.updateCycleDuration(config.DARKNODE_PAYMENT_CYCLE_DURATION_SECS);
    }
}