/// <reference types="../types/truffle-contracts" />

const BN = require("bn.js");
const { execSync } = require("child_process")

const RenToken = artifacts.require("RenToken");
const DarknodePayment = artifacts.require("DarknodePayment");
const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");

const networks = require("./networks.js");

const gitCommit = () => execSync("git describe --always --long").toString().trim();

module.exports = async function (deployer, network) {
    deployer.logger.log(`Deploying to ${network} (${network.replace("-fork", "")})...`);

    network = network.replace("-fork", "");

    const addresses = networks[network] || {};
    const config = networks[network] ? networks[network].config : networks.config;

    const VERSION_STRING = `${network}-${config.VERSION}-${gitCommit()}`;

    RenToken.address = addresses.RenToken || "";
    DarknodeSlasher.address = addresses.DarknodeSlasher || "";
    DarknodeRegistry.address = addresses.DarknodeRegistry || "";
    DarknodeRegistryStore.address = addresses.DarknodeRegistryStore || "";
    DarknodePaymentStore.address = addresses.DarknodePaymentStore || "";
    DarknodePayment.address = addresses.DarknodePayment || "";
    const tokens = addresses.tokens || {};

    if (!RenToken.address) {
        deployer.logger.log("Deploying RenToken");
        await deployer.deploy(RenToken);
    }

    /** DARKNODE REGISTRY *****************************************************/
    if (!DarknodeRegistry.address) {
        deployer.logger.log("Deploying DarknodeRegistryStore");
        await deployer.deploy(
            DarknodeRegistryStore,
            VERSION_STRING,
            RenToken.address,
        );
    }

    if (!DarknodeRegistry.address) {
        deployer.logger.log("Deploying DarknodeRegistry");
        await deployer.deploy(
            DarknodeRegistry,
            VERSION_STRING,
            RenToken.address,
            DarknodeRegistryStore.address,
            config.MINIMUM_BOND,
            config.MINIMUM_POD_SIZE,
            config.MINIMUM_EPOCH_INTERVAL
        );
    }

    const darknodeRegistryStore = await DarknodeRegistryStore.at(DarknodeRegistryStore.address);
    if ((await darknodeRegistryStore.owner()) !== DarknodeRegistry.address) {
        deployer.logger.log("Linking DarknodeRegistryStore and DarknodeRegistry")
        // Initiate ownership transfer of DNR store 
        await darknodeRegistryStore.transferOwnership(DarknodeRegistry.address);

        // Claim ownership
        const darknodeRegistry = await DarknodeRegistry.at(DarknodeRegistry.address);
        await darknodeRegistry.claimStoreOwnership();
    }

    /** SLASHER **************************************************************/
    if (!DarknodeSlasher.address) {
        deployer.logger.log("Deploying DarknodeSlasher");
        await deployer.deploy(
            DarknodeSlasher,
            DarknodeRegistry.address,
        );
    }

    const darknodeRegistry = await DarknodeRegistry.at(DarknodeRegistry.address);
    if ((await darknodeRegistry.slasher()) != DarknodeSlasher.address) {
        deployer.logger.log("Linking DarknodeSlasher and DarknodeRegistry")
        // Update slasher address
        await darknodeRegistry.updateSlasher(DarknodeSlasher.address);
    }

    /** DARKNODE PAYMENT ******************************************************/
    if (!DarknodePaymentStore.address) {
        deployer.logger.log("Deploying DarknodePaymentStore");
        await deployer.deploy(
            DarknodePaymentStore,
            VERSION_STRING,
        );
    }

    let changeCycle = false;
    if (!DarknodePayment.address) {
        // Deploy Darknode Payment
        deployer.logger.log("Deploying DarknodePayment");
        await deployer.deploy(
            DarknodePayment,
            VERSION_STRING,
            DarknodeRegistry.address,
            DarknodePaymentStore.address,
            0, // Cycle Duration (updated below, after a cycle has been called)
        );
        changeCycle = true;
    }

    const darknodePayment = await DarknodePayment.at(DarknodePayment.address);
    for (const tokenName of Object.keys(tokens)) {
        const tokenAddress = tokens[tokenName];
        const registered = await darknodePayment.registeredTokenIndex(tokenAddress);
        if (registered.toString() === "0") {
            deployer.logger.log(`Registering token ${tokenName} in DarknodePayment`);
            await darknodePayment.registerToken(tokenAddress);
        }
    }

    const darknodePaymentStore = await DarknodePaymentStore.at(DarknodePaymentStore.address);
    const currentOwner = await darknodePaymentStore.owner();
    if (currentOwner !== DarknodePayment.address) {
        deployer.logger.log("Linking DarknodePaymentStore and DarknodePayment")
        // Initiate ownership transfer of DarknodePaymentStore

        try {
            await darknodePaymentStore.transferOwnership(DarknodePayment.address, {
                from: currentOwner
            });
        } catch (error) {
            const oldDarknodePayment = await DarknodePayment.at(currentOwner);
            await oldDarknodePayment.transferStoreOwnership(DarknodePayment.address);
        }

        // Update DarknodePaymentStore address
        await darknodePayment.claimStoreOwnership();
    }

    if (new BN(await darknodePayment.cycleDuration()).toNumber() !== config.DARKNODE_PAYMENT_CYCLE_DURATION_SECONDS) {
        deployer.logger.log(`Updating cycle duration to ${config.DARKNODE_PAYMENT_CYCLE_DURATION_SECONDS}`);
        await darknodePayment.updateCycleDuration(config.DARKNODE_PAYMENT_CYCLE_DURATION_SECONDS);
    }

    if (changeCycle) {
        try {
            deployer.logger.log("Attempting to change cycle");
            await darknodePayment.changeCycle();
        } catch (error) {
            deployer.logger.log("Unable to call darknodePayment.changeCycle()");
        }
    }

    deployer.logger.log({
        RenToken: RenToken.address,
        DarknodeSlasher: DarknodeSlasher.address,
        DarknodeRegistry: DarknodeRegistry.address,
        DarknodeRegistryStore: DarknodeRegistryStore.address,
        DarknodePaymentStore: DarknodePaymentStore.address,
        DarknodePayment: DarknodePayment.address,
    });
}