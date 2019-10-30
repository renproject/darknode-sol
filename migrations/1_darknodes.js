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

/**
 * @dev In order to specify what contracts to re-deploy, update `networks.js`.
 * 
 * For the network you want to use, set the contracts' addresses to `""` and run:
 * `NETWORK=testnet yarn deploy` (replacing network)
 *
 * Don't forget to verify the contracts on etherscan:
 * `NETWORK=testnet yarn verify DarknodePayment DarknodePaymentStore`
 * (replacing network and contract names)
 * 
 * @param {any} deployer
 * @param {string} network
 */
module.exports = async function (deployer, network, accounts) {
    deployer.logger.log(`Deploying to ${network} (${network.replace("-fork", "")})...`);

    network = network.replace("-fork", "");

    const addresses = networks[network] || {};
    const config = networks[network] ? networks[network].config : networks.config;

    const VERSION_STRING = `${network}-${gitCommit()}`;

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
    if (!DarknodeRegistryStore.address) {
        deployer.logger.log("Deploying DarknodeRegistryStore");
        await deployer.deploy(
            DarknodeRegistryStore,
            VERSION_STRING,
            RenToken.address,
        );
    }
    const darknodeRegistryStore = await DarknodeRegistryStore.at(DarknodeRegistryStore.address);

    if (!DarknodeRegistry.address) {
        deployer.logger.log("Deploying DarknodeRegistry");
        await deployer.deploy(
            DarknodeRegistry,
            VERSION_STRING,
            RenToken.address,
            DarknodeRegistryStore.address,
            config.MINIMUM_BOND,
            config.MINIMUM_POD_SIZE,
            config.MINIMUM_EPOCH_INTERVAL_SECONDS
        );
    }
    const darknodeRegistry = await DarknodeRegistry.at(DarknodeRegistry.address);

    const storeOwner = await darknodeRegistryStore.owner();
    if (storeOwner !== DarknodeRegistry.address) {
        deployer.logger.log("Linking DarknodeRegistryStore and DarknodeRegistry")
        if (storeOwner === accounts[0]) {
            // Initiate ownership transfer of DNR store 
            await darknodeRegistryStore.transferOwnership(DarknodeRegistry.address);

            // Claim ownership
            await darknodeRegistry.claimStoreOwnership();
        } else {
            const oldDNR = await DarknodeRegistry.at(storeOwner);
            oldDNR.transferStoreOwnership(DarknodeRegistry.address);
            // This will also call claim.
        }
    }

    /***************************************************************************
     ** SLASHER ****************************************************************
     **************************************************************************/
    if (!DarknodeSlasher.address) {
        deployer.logger.log("Deploying DarknodeSlasher");
        await deployer.deploy(
            DarknodeSlasher,
            DarknodeRegistry.address,
        );
    }
    const slasher = await DarknodeSlasher.at(DarknodeSlasher.address);

    const dnrInSlasher = await slasher.darknodeRegistry();
    if (dnrInSlasher.toLowerCase() !== DarknodeRegistry.address.toLowerCase()) {
        deployer.logger.log("Updating DNR in Slasher");
        await slasher.updateDarknodeRegistry(DarknodeRegistry.address);
    }

    // Set the slash percentages
    const blacklistSlashPercent = new BN(await slasher.blacklistSlashPercent.call()).toNumber();
    if (blacklistSlashPercent !== config.BLACKLIST_SLASH_PERCENT) {
        deployer.logger.log("Setting blacklist slash percent");
        await slasher.setBlacklistSlashPercent(new BN(config.BLACKLIST_SLASH_PERCENT));
    }
    const maliciousSlashPercent = new BN(await slasher.maliciousSlashPercent.call()).toNumber();
    if (maliciousSlashPercent !== config.MALICIOUS_SLASH_PERCENT) {
        deployer.logger.log("Setting malicious slash percent");
        await slasher.setMaliciousSlashPercent(new BN(config.MALICIOUS_SLASH_PERCENT));
    }
    const secretRevealSlashPercent = new BN(await slasher.secretRevealSlashPercent.call()).toNumber();
    if (secretRevealSlashPercent !== config.SECRET_REVEAL_SLASH_PERCENT) {
        deployer.logger.log("Setting secret reveal slash percent");
        await slasher.setSecretRevealSlashPercent(new BN(config.SECRET_REVEAL_SLASH_PERCENT));
    }

    const currentSlasher = await darknodeRegistry.slasher.call();
    const nextSlasher = await darknodeRegistry.nextSlasher.call();
    if (currentSlasher.toLowerCase() != DarknodeSlasher.address.toLowerCase() && nextSlasher.toLowerCase() != DarknodeSlasher.address.toLowerCase()) {
        deployer.logger.log("Linking DarknodeSlasher and DarknodeRegistry")
        // Update slasher address
        await darknodeRegistry.updateSlasher(DarknodeSlasher.address);
    }

    /***************************************************************************
     ** DARKNODE PAYMENT *******************************************************
     **************************************************************************/
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
            config.DARKNODE_PAYOUT_PERCENT, // Reward payout percentage (50% is paid out at any given cycle)
        );
        changeCycle = true;
    }
    // Update darknode payment address
    if ((await darknodeRegistry.darknodePayment()).toLowerCase() !== DarknodePayment.address.toLowerCase()) {
        deployer.logger.log("Updating DarknodeRegistry's darknode payment");
        await darknodeRegistry.updateDarknodePayment(DarknodePayment.address);
    }

    const darknodePayment = await DarknodePayment.at(DarknodePayment.address);
    for (const tokenName of Object.keys(tokens)) {
        const tokenAddress = tokens[tokenName];
        const registered = (await darknodePayment.registeredTokenIndex.call(tokenAddress)).toString() !== "0";
        const pendingRegistration = await darknodePayment.tokenPendingRegistration.call(tokenAddress);
        if (!registered && !pendingRegistration) {
            deployer.logger.log(`Registering token ${tokenName} in DarknodePayment`);
            await darknodePayment.registerToken(tokenAddress);
        }
    }

    const dnrInDarknodePayment = await darknodePayment.darknodeRegistry();
    if (dnrInDarknodePayment.toLowerCase() !== DarknodeRegistry.address.toLowerCase()) {
        deployer.logger.log("Updating DNR in DNP");
        await darknodePayment.updateDarknodeRegistry(DarknodeRegistry.address);
    }

    const darknodePaymentStore = await DarknodePaymentStore.at(DarknodePaymentStore.address);
    const currentOwner = await darknodePaymentStore.owner.call();
    if (currentOwner !== DarknodePayment.address) {
        deployer.logger.log("Linking DarknodePaymentStore and DarknodePayment");

        if (currentOwner === accounts[0]) {
            await darknodePaymentStore.transferOwnership(DarknodePayment.address);

            // Update DarknodePaymentStore address
            await darknodePayment.claimStoreOwnership();
        } else {
            const oldDarknodePayment = await DarknodePayment.at(currentOwner);
            await oldDarknodePayment.transferStoreOwnership(DarknodePayment.address);
            // This will also call claim.
        }
    }

    if (changeCycle) {
        try {
            deployer.logger.log("Attempting to change cycle");
            await darknodePayment.changeCycle();
        } catch (error) {
            deployer.logger.log("Unable to call darknodePayment.changeCycle()");
        }
    }
    // Set the darknode payment cycle changer to the darknode registry
    deployer.logger.log("Setting the DarknodePayment's cycle changer");
    if ((await darknodePayment.cycleChanger()).toLowerCase() !== DarknodeRegistry.address.toLowerCase()) {
        deployer.logger.log("Setting the DarknodePayment's cycle changer");
        await darknodePayment.updateCycleChanger(DarknodeRegistry.address);
    }

    deployer.logger.log({
        RenToken: RenToken.address,
        DarknodeSlasher: DarknodeSlasher.address,
        DarknodeRegistry: DarknodeRegistry.address,
        DarknodeRegistryStore: DarknodeRegistryStore.address,
        DarknodePayment: DarknodePayment.address,
        DarknodePaymentStore: DarknodePaymentStore.address,
    });
}