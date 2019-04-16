/// <reference types="../test-ts/typings/truffle" />

const PaymentToken = artifacts.require("PaymentToken");
const RenToken = artifacts.require("RenToken");
const DarknodePayment = artifacts.require("DarknodePayment");
const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");

const config = require("./config.js");

module.exports = async function (deployer, network) {

    const VERSION_STRING = `${network}-${config.VERSION}`;

    await deployer
        .deploy(RenToken)
        .then(() => deployer.deploy(
            PaymentToken
        ))
        .then(() => deployer.deploy(
            DarknodeRegistryStore,
            VERSION_STRING,
            RenToken.address,
        ))
        .then(() => deployer.deploy(
            DarknodeRegistry,
            VERSION_STRING,
            RenToken.address,
            DarknodeRegistryStore.address,
            config.MINIMUM_BOND,
            config.MINIMUM_POD_SIZE,
            config.MINIMUM_EPOCH_INTERVAL
        ))
        .then(async () => {
            // Initiate ownership transfer of DNR store 
            const darknodeRegistryStore = await DarknodeRegistryStore.at(DarknodeRegistryStore.address);
            await darknodeRegistryStore.transferOwnership(DarknodeRegistry.address);

            // Claim ownership
            const darknodeRegistry = await DarknodeRegistry.at(DarknodeRegistry.address);
            await darknodeRegistry.claimStoreOwnership();
        })
        .then(() => deployer.deploy(
            DarknodePaymentStore,
            VERSION_STRING,
        ))
        .then(() => deployer.deploy(
            DarknodePayment,
            VERSION_STRING,
            DarknodeRegistry.address,
            DarknodePaymentStore.address,
            config.DARKNODE_PAYMENT_CYCLE_DURATION,
        ))
        .then(() => deployer.deploy(
            DarknodeSlasher,
            DarknodeRegistry.address,
        ))
        .then(async () => {
            // Initiate ownership transfer of DNP store
            const darknodePaymentStore = await DarknodePaymentStore.at(DarknodePaymentStore.address);
            await darknodePaymentStore.transferOwnership(DarknodePayment.address);

            // Update DarknodePaymentStore address
            const darknodePayment = await DarknodePayment.at(DarknodePayment.address);
            await darknodePayment.claimStoreOwnership();

            // Update slasher address
            const darknodeRegistry = await DarknodeRegistry.at(DarknodeRegistry.address);
            await darknodeRegistry.updateSlasher(DarknodeSlasher.address);
        });
}