/// <reference types="../types/truffle-contracts" />

const BN = require("bn.js");
const { execSync } = require("child_process")

const RenToken = artifacts.require("RenToken");
const DarknodePayment = artifacts.require("DarknodePayment");
const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");
const Protocol = artifacts.require("Protocol");
const ProtocolLogic = artifacts.require("ProtocolLogic");

const networks = require("./networks.js");

const gitCommit = () => execSync("git describe --always --long").toString().trim();

const encodeCallData = (functioName, parameterTypes, parameters) => {
    return web3.eth.abi.encodeFunctionSignature(`${functioName}(${parameterTypes.join(",")})`) + web3.eth.abi.encodeParameters(parameterTypes, parameters).slice(2);
}

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
module.exports = async function (deployer, network, [contractOwner, proxyOwner]) {
    deployer.logger.log(`Deploying to ${network} (${network.replace("-fork", "")})...`);

    network = network.replace("-fork", "");

    const addresses = networks[network] || {};
    const config = networks[network] ? networks[network].config : networks.config;
    proxyOwner = proxyOwner || config.proxyOwner;

    const VERSION_STRING = `${network}-${gitCommit()}`;

    RenToken.address = addresses.RenToken || "";
    DarknodeSlasher.address = addresses.DarknodeSlasher || "";
    DarknodeRegistry.address = addresses.DarknodeRegistry || "";
    DarknodeRegistryStore.address = addresses.DarknodeRegistryStore || "";
    DarknodePaymentStore.address = addresses.DarknodePaymentStore || "";
    DarknodePayment.address = addresses.DarknodePayment || "";
    Protocol.address = addresses.Protocol || "";
    ProtocolLogic.address = addresses.ProtocolLogic || "";
    const tokens = addresses.tokens || {};

    let actionCount = 0;

    /** PROTOCOL **************************************************************/
    if (!ProtocolLogic.address) {
        deployer.logger.log("Deploying ProtocolLogic");
        await deployer.deploy(ProtocolLogic);
        actionCount++;
    }

    let protocolProxy;
    if (!Protocol.address) {
        deployer.logger.log("Deploying Protocol");
        await deployer.deploy(Protocol);
        protocolProxy = await Protocol.at(Protocol.address);
        await protocolProxy.initialize(ProtocolLogic.address, proxyOwner, encodeCallData("initialize", ["address"], [contractOwner]));
        // await protocolProxy.changeAdmin(proxyOwner, { from: contractOwner });
        actionCount++;
    } else {
        protocolProxy = await Protocol.at(Protocol.address);
    }

    const protocolProxyLogic = await protocolProxy.implementation.call({ from: proxyOwner });
    if (protocolProxyLogic.toLowerCase() !== ProtocolLogic.address.toLowerCase()) {
        deployer.logger.log(`Upgrading Protocol proxy's logic contract. Was ${protocolProxyLogic}, now is ${ProtocolLogic.address}`);
        await protocolProxy.upgradeTo(ProtocolLogic.address, { from: proxyOwner });
        actionCount++;
    }

    const protocol = await ProtocolLogic.at(Protocol.address);

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
        actionCount++;
    }
    const darknodeRegistry = await DarknodeRegistry.at(DarknodeRegistry.address);

    const protocolDarknodeRegistry = await await protocol.darknodeRegistry.call({ from: contractOwner });
    if (protocolDarknodeRegistry.toLowerCase() !== darknodeRegistry.address.toLowerCase()) {
        deployer.logger.log(`Updating DarknodeRegistry in Protocol contract. Was ${protocolDarknodeRegistry}, now is ${darknodeRegistry.address}`);
        await protocol._updateDarknodeRegistry(darknodeRegistry.address, { from: contractOwner });
        actionCount++;
    }

    const storeOwner = await darknodeRegistryStore.owner.call();
    if (storeOwner !== DarknodeRegistry.address) {
        deployer.logger.log("Linking DarknodeRegistryStore and DarknodeRegistry")
        if (storeOwner === contractOwner) {
            // Initiate ownership transfer of DNR store 
            await darknodeRegistryStore.transferOwnership(DarknodeRegistry.address);

            // Claim ownership
            deployer.logger.log(`Claiming DNRS ownership in DNR`);
            await darknodeRegistry.claimStoreOwnership();
        } else {
            deployer.logger.log(`Transferring DNRS ownership from ${storeOwner} to new DNR`);
            const oldDNR = await DarknodeRegistry.at(storeOwner);
            oldDNR.transferStoreOwnership(DarknodeRegistry.address);
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

    /***************************************************************************
     ** SLASHER ****************************************************************
     **************************************************************************/
    if (!DarknodeSlasher.address) {
        deployer.logger.log("Deploying DarknodeSlasher");
        await deployer.deploy(
            DarknodeSlasher,
            DarknodeRegistry.address,
        );
        actionCount++;
    }
    const slasher = await DarknodeSlasher.at(DarknodeSlasher.address);

    const dnrInSlasher = await slasher.darknodeRegistry.call();
    if (dnrInSlasher.toLowerCase() !== DarknodeRegistry.address.toLowerCase()) {
        deployer.logger.log("Updating DNR in Slasher");
        await slasher.updateDarknodeRegistry(DarknodeRegistry.address);
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
            DarknodeRegistry.address,
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
    if (dnrInDarknodePayment.toLowerCase() !== DarknodeRegistry.address.toLowerCase()) {
        deployer.logger.log("Updating DNR in DNP");
        await darknodePayment.updateDarknodeRegistry(DarknodeRegistry.address);
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
    if ((await darknodePayment.cycleChanger()).toLowerCase() !== DarknodeRegistry.address.toLowerCase()) {
        deployer.logger.log("Setting the DarknodePayment's cycle changer");
        await darknodePayment.updateCycleChanger(DarknodeRegistry.address);
        actionCount++;
    }

    deployer.logger.log(`Performed ${actionCount} updates.`);

    deployer.logger.log({
        Protocol: Protocol.address,
        ProtocolLogic: ProtocolLogic.address,
        RenToken: RenToken.address,
        DarknodeSlasher: DarknodeSlasher.address,
        DarknodeRegistry: DarknodeRegistry.address,
        DarknodeRegistryStore: DarknodeRegistryStore.address,
        DarknodePayment: DarknodePayment.address,
        DarknodePaymentStore: DarknodePaymentStore.address,
    });
}