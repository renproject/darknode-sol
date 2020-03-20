/// <reference types="../types/truffle-contracts" />

const BN = require("bn.js");
const { execSync } = require("child_process")

const RenToken = artifacts.require("RenToken");
const DarknodePayment = artifacts.require("DarknodePayment");
const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistryProxy = artifacts.require("DarknodeRegistryProxy");
const DarknodeRegistryLogicV1 = artifacts.require("DarknodeRegistryLogicV1");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");
const ProtocolProxy = artifacts.require("ProtocolProxy");
const ProtocolLogicV1 = artifacts.require("ProtocolLogicV1");
const RenProxyAdmin = artifacts.require("RenProxyAdmin");

const networks = require("./networks.js");

const { encodeCallData } = require("./encode");

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
module.exports = async function (deployer, network, [contractOwner]) {
    deployer.logger.log(`Deploying to ${network} (${network.replace("-fork", "")})...`);

    network = network.replace("-fork", "");

    const addresses = networks[network] || {};
    const config = networks[network] ? networks[network].config : networks.config;

    const VERSION_STRING = `${network}-${gitCommit()}`;

    RenToken.address = addresses.RenToken || "";
    DarknodeSlasher.address = addresses.DarknodeSlasher || "";
    DarknodeRegistryProxy.address = addresses.DarknodeRegistryProxy || "";
    DarknodeRegistryLogicV1.address = addresses.DarknodeRegistryLogicV1 || "";
    DarknodeRegistryStore.address = addresses.DarknodeRegistryStore || "";
    DarknodePaymentStore.address = addresses.DarknodePaymentStore || "";
    DarknodePayment.address = addresses.DarknodePayment || "";
    ProtocolProxy.address = addresses.ProtocolProxy || "";
    ProtocolLogicV1.address = addresses.ProtocolLogicV1 || "";
    RenProxyAdmin.address = addresses.RenProxyAdmin || "";
    const tokens = addresses.tokens || {};

    let actionCount = 0;

    /** PROXY ADMIN ***********************************************************/
    if (!RenProxyAdmin.address) {
        deployer.logger.log("Deploying Proxy ");
        await deployer.deploy(RenProxyAdmin);
        actionCount++;
    }
    let renProxyAdmin = await RenProxyAdmin.at(RenProxyAdmin.address);

    /** PROTOCOL **************************************************************/
    if (!ProtocolLogicV1.address) {
        deployer.logger.log("Deploying ProtocolLogicV1");
        await deployer.deploy(ProtocolLogicV1);
        actionCount++;
    }

    let protocolProxy;
    if (!ProtocolProxy.address) {
        deployer.logger.log("Deploying ProtocolProxy");
        await deployer.deploy(ProtocolProxy);
        protocolProxy = await ProtocolProxy.at(ProtocolProxy.address);
        await protocolProxy.initialize(ProtocolLogicV1.address, renProxyAdmin.address, encodeCallData(web3, "initialize", ["address"], [contractOwner]));
        actionCount++;
    } else {
        protocolProxy = await ProtocolProxy.at(ProtocolProxy.address);
    }

    const protocolProxyLogic = await renProxyAdmin.getProxyImplementation(protocolProxy.address);
    if (protocolProxyLogic.toLowerCase() !== ProtocolLogicV1.address.toLowerCase()) {
        throw new Error("ERROR: ProtocolProxy is pointing to out-dated ProtocolLogicV1.");
    }

    const protocol = await ProtocolLogicV1.at(ProtocolProxy.address);

    /** Ren TOKEN *************************************************************/
    if (!RenToken.address) {
        deployer.logger.log("Deploying RenToken");
        await deployer.deploy(RenToken);
        actionCount++;
    }

    /** DARKNODE REGISTRY *****************************************************/
    if (!DarknodeRegistryStore.address) {
        deployer.logger.log("Deploying DarknodeRegistryStore");
        await deployer.deploy(
            DarknodeRegistryStore,
            VERSION_STRING,
            RenToken.address,
        );
        actionCount++;
    }
    const darknodeRegistryStore = await DarknodeRegistryStore.at(DarknodeRegistryStore.address);

    if (!DarknodeRegistryLogicV1.address) {
        deployer.logger.log("Deploying DarknodeRegistryLogicV1");
        await deployer.deploy(DarknodeRegistryLogicV1);
    }
    const darknodeRegistryLogic = await DarknodeRegistryLogicV1.at(DarknodeRegistryLogicV1.address);

    if (!DarknodeRegistryProxy.address) {
        deployer.logger.log("Deploying DarknodeRegistry");
        await deployer.deploy(DarknodeRegistryProxy);
        protocolProxy = await DarknodeRegistryProxy.at(DarknodeRegistryProxy.address);
        await protocolProxy.initialize(darknodeRegistryLogic.address, renProxyAdmin.address, encodeCallData(
            web3,
            "initialize",
            ["string", "address", "address", "uint256", "uint256", "uint256", "uint256"],
            [VERSION_STRING, RenToken.address, DarknodeRegistryStore.address, config.MINIMUM_BOND.toString(), config.MINIMUM_POD_SIZE, config.MINIMUM_EPOCH_INTERVAL_SECONDS, 0,],
        ));
        actionCount++;
    }
    const darknodeRegistry = await DarknodeRegistryLogicV1.at(DarknodeRegistryProxy.address);

    const storeOwner = await darknodeRegistryStore.owner.call();
    if (storeOwner !== darknodeRegistry.address) {
        deployer.logger.log("Linking DarknodeRegistryStore and DarknodeRegistry")
        if (storeOwner === contractOwner) {
            // Initiate ownership transfer of DNR store 
            await darknodeRegistryStore.transferOwnership(darknodeRegistry.address);

            // Claim ownership
            deployer.logger.log(`Claiming DNRS ownership in DNR`);
            await darknodeRegistry.claimStoreOwnership();
        } else {
            deployer.logger.log(`Transferring DNRS ownership from ${storeOwner} to new DNR`);
            const oldDNR = await DarknodeRegistryLogicV1.at(storeOwner);
            oldDNR.transferStoreOwnership(darknodeRegistry.address);
            // This will also call claim, but we try anyway because older
            // contracts didn't:
            try {
                // Claim ownership
                await darknodeRegistry.claimStoreOwnership();
            } catch (error) {
                // Ignore
            }
        }
        actionCount++;
    }

    const protocolDarknodeRegistry = await await protocol.darknodeRegistry.call();
    if (protocolDarknodeRegistry.toLowerCase() !== darknodeRegistry.address.toLowerCase()) {
        deployer.logger.log(`Updating DarknodeRegistry in Protocol contract. Was ${protocolDarknodeRegistry}, now is ${darknodeRegistry.address}`);
        await protocol._updateDarknodeRegistry(darknodeRegistry.address);
        actionCount++;
    }

    /***************************************************************************
     ** SLASHER ****************************************************************
     **************************************************************************/
    if (!DarknodeSlasher.address) {
        deployer.logger.log("Deploying DarknodeSlasher");
        await deployer.deploy(
            DarknodeSlasher,
            darknodeRegistry.address,
        );
        actionCount++;
    }
    const slasher = await DarknodeSlasher.at(DarknodeSlasher.address);

    const dnrInSlasher = await slasher.darknodeRegistry.call();
    if (dnrInSlasher.toLowerCase() !== darknodeRegistry.address.toLowerCase()) {
        deployer.logger.log("Updating DNR in Slasher");
        await slasher.updateDarknodeRegistry(darknodeRegistry.address);
        actionCount++;
    }

    // Set the slash percentages
    const blacklistSlashPercent = new BN(await slasher.blacklistSlashPercent.call()).toNumber();
    if (blacklistSlashPercent !== config.BLACKLIST_SLASH_PERCENT) {
        deployer.logger.log("Setting blacklist slash percent");
        await slasher.setBlacklistSlashPercent(new BN(config.BLACKLIST_SLASH_PERCENT));
        actionCount++;
    }
    const maliciousSlashPercent = new BN(await slasher.maliciousSlashPercent.call()).toNumber();
    if (maliciousSlashPercent !== config.MALICIOUS_SLASH_PERCENT) {
        deployer.logger.log("Setting malicious slash percent");
        await slasher.setMaliciousSlashPercent(new BN(config.MALICIOUS_SLASH_PERCENT));
        actionCount++;
    }
    const secretRevealSlashPercent = new BN(await slasher.secretRevealSlashPercent.call()).toNumber();
    if (secretRevealSlashPercent !== config.SECRET_REVEAL_SLASH_PERCENT) {
        deployer.logger.log("Setting secret reveal slash percent");
        await slasher.setSecretRevealSlashPercent(new BN(config.SECRET_REVEAL_SLASH_PERCENT));
        actionCount++;
    }

    const currentSlasher = await darknodeRegistry.slasher.call();
    const nextSlasher = await darknodeRegistry.nextSlasher.call();
    if (currentSlasher.toLowerCase() != DarknodeSlasher.address.toLowerCase() && nextSlasher.toLowerCase() != DarknodeSlasher.address.toLowerCase()) {
        deployer.logger.log("Linking DarknodeSlasher and DarknodeRegistry")
        // Update slasher address
        await darknodeRegistry.updateSlasher(DarknodeSlasher.address);
        actionCount++;
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
        actionCount++;
    }

    if (!DarknodePayment.address) {
        // Deploy Darknode Payment
        deployer.logger.log("Deploying DarknodePayment");
        await deployer.deploy(
            DarknodePayment,
            VERSION_STRING,
            darknodeRegistry.address,
            DarknodePaymentStore.address,
            config.DARKNODE_PAYOUT_PERCENT, // Reward payout percentage (50% is paid out at any given cycle)
        );
        actionCount++;
    }
    // Update darknode payment address
    if ((await darknodeRegistry.darknodePayment()).toLowerCase() !== DarknodePayment.address.toLowerCase()) {
        deployer.logger.log("Updating DarknodeRegistry's darknode payment");
        await darknodeRegistry.updateDarknodePayment(DarknodePayment.address);
        actionCount++;
    }

    const darknodePayment = await DarknodePayment.at(DarknodePayment.address);
    for (const tokenName of Object.keys(tokens)) {
        const tokenAddress = tokens[tokenName];
        const registered = (await darknodePayment.registeredTokenIndex.call(tokenAddress)).toString() !== "0";
        const pendingRegistration = await darknodePayment.tokenPendingRegistration.call(tokenAddress);
        if (!registered && !pendingRegistration) {
            deployer.logger.log(`Registering token ${tokenName} in DarknodePayment`);
            await darknodePayment.registerToken(tokenAddress);
            actionCount++;
        }
    }

    const dnrInDarknodePayment = await darknodePayment.darknodeRegistry.call();
    if (dnrInDarknodePayment.toLowerCase() !== darknodeRegistry.address.toLowerCase()) {
        deployer.logger.log("Updating DNR in DNP");
        await darknodePayment.updateDarknodeRegistry(darknodeRegistry.address);
        actionCount++;
    }

    const darknodePaymentStore = await DarknodePaymentStore.at(DarknodePaymentStore.address);
    const currentOwner = await darknodePaymentStore.owner.call();
    if (currentOwner !== DarknodePayment.address) {
        deployer.logger.log("Linking DarknodePaymentStore and DarknodePayment");

        if (currentOwner === contractOwner) {
            await darknodePaymentStore.transferOwnership(DarknodePayment.address);

            // Update DarknodePaymentStore address
            deployer.logger.log(`Claiming DNPS ownership in DNP`);
            await darknodePayment.claimStoreOwnership();
        } else {
            deployer.logger.log(`Transferring DNPS ownership from ${currentOwner} to new DNP`);
            const oldDarknodePayment = await DarknodePayment.at(currentOwner);
            await oldDarknodePayment.transferStoreOwnership(DarknodePayment.address);
            // This will also call claim, but we try anyway because older
            // contracts didn't:
            try {
                // Claim ownership
                await darknodePayment.claimStoreOwnership();
            } catch (error) {
                // Ignore
            }
        }
        actionCount++;
    }

    // if (changeCycle) {
    //     try {
    //         deployer.logger.log("Attempting to change cycle");
    //         await darknodePayment.changeCycle();
    //     } catch (error) {
    //         deployer.logger.log("Unable to call darknodePayment.changeCycle()");
    //     }
    // }

    // Set the darknode payment cycle changer to the darknode registry
    if ((await darknodePayment.cycleChanger()).toLowerCase() !== darknodeRegistry.address.toLowerCase()) {
        deployer.logger.log("Setting the DarknodePayment's cycle changer");
        await darknodePayment.updateCycleChanger(darknodeRegistry.address);
        actionCount++;
    }

    deployer.logger.log(`Performed ${actionCount} updates.`);

    deployer.logger.log({
        Protocol: ProtocolProxy.address,
        ProtocolLogicV1: ProtocolLogicV1.address,
        RenToken: RenToken.address,
        DarknodeSlasher: DarknodeSlasher.address,
        DarknodeRegistry: darknodeRegistry.address,
        DarknodeRegistryStore: DarknodeRegistryStore.address,
        DarknodePayment: DarknodePayment.address,
        DarknodePaymentStore: DarknodePaymentStore.address,
    });
}