/// <reference types="../types/truffle-contracts" />

const BN = require("bn.js");
const { execSync } = require("child_process");

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

const NULL = "0x0000000000000000000000000000000000000000";

const gitCommit = () =>
    execSync("git describe --always --long")
        .toString()
        .trim();

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
module.exports = async function(deployer, network) {
    const contractOwner = (await web3.eth.getAccounts())[0];
    const Ox = web3.utils.toChecksumAddress;

    deployer.logger.log(
        `Deploying to ${network} (${network.replace("-fork", "")})...`
    );

    network = network.replace("-fork", "");

    const addresses = networks[network] || {};
    const config = networks[network]
        ? networks[network].config
        : networks.config;

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
    const protocolLogic = await ProtocolLogicV1.at(ProtocolLogicV1.address);
    const protocolParameters = { types: ["address"], values: [contractOwner] };

    // Initialize ProtocolLogic so others can't initialize it.
    const protocolLogicOwner = await protocolLogic.owner.call();
    if (Ox(protocolLogicOwner) === Ox(NULL)) {
        deployer.logger.log("Ensuring ProtocolLogic is initialized");
        await protocolLogic.initialize(...protocolParameters.values);
        actionCount++;
    }

    let protocolProxy;
    if (!ProtocolProxy.address) {
        deployer.logger.log("Deploying ProtocolProxy");
        await deployer.deploy(ProtocolProxy);
        protocolProxy = await ProtocolProxy.at(ProtocolProxy.address);
        await protocolProxy.initialize(
            protocolLogic.address,
            renProxyAdmin.address,
            encodeCallData(
                web3,
                "initialize",
                protocolParameters.types,
                protocolParameters.values
            )
        );
        actionCount++;
    } else {
        protocolProxy = await ProtocolProxy.at(ProtocolProxy.address);
    }

    const protocolProxyLogic = await renProxyAdmin.getProxyImplementation(
        protocolProxy.address
    );
    if (Ox(protocolProxyLogic) !== Ox(ProtocolLogicV1.address)) {
        throw new Error(
            "ERROR: ProtocolProxy is pointing to out-dated ProtocolLogicV1."
        );
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
            RenToken.address
        );
        actionCount++;
    }
    const darknodeRegistryStore = await DarknodeRegistryStore.at(
        DarknodeRegistryStore.address
    );

    if (!DarknodeRegistryLogicV1.address) {
        deployer.logger.log("Deploying DarknodeRegistryLogicV1");
        await deployer.deploy(DarknodeRegistryLogicV1);
    }
    const darknodeRegistryLogic = await DarknodeRegistryLogicV1.at(
        DarknodeRegistryLogicV1.address
    );
    const darknodeRegistryParameters = {
        types: [
            "string",
            "address",
            "address",
            "uint256",
            "uint256",
            "uint256",
            "uint256"
        ],
        values: [
            VERSION_STRING,
            RenToken.address,
            DarknodeRegistryStore.address,
            config.MINIMUM_BOND.toString(),
            config.MINIMUM_POD_SIZE,
            config.MINIMUM_EPOCH_INTERVAL_SECONDS,
            0
        ]
    };

    // Initialize darknodeRegistryLogic so others can't initialize it.
    const darknodeRegistryLogicOwner = await darknodeRegistryLogic.owner.call();
    if (Ox(darknodeRegistryLogicOwner) === Ox(NULL)) {
        deployer.logger.log("Ensuring DarknodeRegistryLogic is initialized");
        await darknodeRegistryLogic.initialize(
            "",
            NULL,
            NULL,
            "0",
            "0",
            "0",
            0
        );
        actionCount++;
    }

    let darknodeRegistryProxy;
    if (!DarknodeRegistryProxy.address) {
        deployer.logger.log("Deploying DarknodeRegistry");
        await deployer.deploy(DarknodeRegistryProxy);
        darknodeRegistryProxy = await DarknodeRegistryProxy.at(
            DarknodeRegistryProxy.address
        );
        await darknodeRegistryProxy.initialize(
            darknodeRegistryLogic.address,
            renProxyAdmin.address,
            encodeCallData(
                web3,
                "initialize",
                darknodeRegistryParameters.types,
                darknodeRegistryParameters.values
            )
        );
        actionCount++;
    } else {
        darknodeRegistryProxy = await DarknodeRegistryProxy.at(
            DarknodeRegistryProxy.address
        );
    }
    const darknodeRegistry = await DarknodeRegistryLogicV1.at(
        DarknodeRegistryProxy.address
    );

    const darknodeRegistryProxyLogic = await renProxyAdmin.getProxyImplementation(
        darknodeRegistryProxy.address
    );
    if (Ox(darknodeRegistryProxyLogic) !== Ox(darknodeRegistryLogic.address)) {
        deployer.logger.log(
            `DarknodeRegistryProxy is pointing to out-dated ProtocolLogic. Was ${Ox(
                darknodeRegistryProxyLogic
            )}, now is ${Ox(darknodeRegistryLogic.address)}`
        );
        await renProxyAdmin.upgrade(
            darknodeRegistryProxy.address,
            darknodeRegistryLogic.address
        );
        actionCount++;
    }

    const storeOwner = await darknodeRegistryStore.owner.call();
    if (Ox(storeOwner) !== Ox(darknodeRegistry.address)) {
        deployer.logger.log(
            "Linking DarknodeRegistryStore and DarknodeRegistry"
        );
        if (Ox(storeOwner) === Ox(contractOwner)) {
            // Initiate ownership transfer of DNR store
            const pendingOwner = await darknodeRegistryStore.pendingOwner.call();
            if (Ox(pendingOwner) !== Ox(darknodeRegistry.address)) {
                deployer.logger.log(
                    "Transferring DarknodeRegistryStore ownership"
                );
                await darknodeRegistryStore.transferOwnership(
                    darknodeRegistry.address
                );
            }

            // Claim ownership
            deployer.logger.log(`Claiming DNRS ownership in DNR`);
            await darknodeRegistry.claimStoreOwnership();
        } else {
            deployer.logger.log(
                `Transferring DNRS ownership from ${storeOwner} to new DNR`
            );
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

    const protocolDarknodeRegistry = await protocol.darknodeRegistry.call();
    if (Ox(protocolDarknodeRegistry) !== Ox(darknodeRegistry.address)) {
        deployer.logger.log(
            `Updating DarknodeRegistry in Protocol contract. Was ${protocolDarknodeRegistry}, now is ${darknodeRegistry.address}`
        );
        await protocol._updateDarknodeRegistry(darknodeRegistry.address);
        actionCount++;
    }

    const renInDNR = await darknodeRegistry.ren.call();
    if (Ox(renInDNR) !== Ox(RenToken.address)) {
        console.error(
            `ERROR! DNR is pointing to wrong REN token - ${Ox(
                renInDNR
            )} instead of ${Ox(
                RenToken.address
            )} - DNR should be updated or redeployed.`
        );
    }

    const renInDNRS = await darknodeRegistryStore.ren.call();
    if (Ox(renInDNRS) !== Ox(RenToken.address)) {
        console.error(
            `ERROR! DNRS is pointing to wrong REN token - ${Ox(
                renInDNRS
            )} instead of ${Ox(
                RenToken.address
            )} - DNRS should be updated or redeployed.`
        );
    }

    /***************************************************************************
     ** SLASHER ****************************************************************
     **************************************************************************/
    if (!DarknodeSlasher.address) {
        deployer.logger.log("Deploying DarknodeSlasher");
        await deployer.deploy(DarknodeSlasher, darknodeRegistry.address);
        actionCount++;
    }
    const slasher = await DarknodeSlasher.at(DarknodeSlasher.address);

    const dnrInSlasher = await slasher.darknodeRegistry.call();
    if (Ox(dnrInSlasher) !== Ox(darknodeRegistry.address)) {
        deployer.logger.log("Updating DNR in Slasher");
        await slasher.updateDarknodeRegistry(darknodeRegistry.address);
        actionCount++;
    }

    // Set the slash percentages
    const blacklistSlashPercent = new BN(
        await slasher.blacklistSlashPercent.call()
    ).toNumber();
    if (blacklistSlashPercent !== config.BLACKLIST_SLASH_PERCENT) {
        deployer.logger.log("Setting blacklist slash percent");
        await slasher.setBlacklistSlashPercent(
            new BN(config.BLACKLIST_SLASH_PERCENT)
        );
        actionCount++;
    }
    const maliciousSlashPercent = new BN(
        await slasher.maliciousSlashPercent.call()
    ).toNumber();
    if (maliciousSlashPercent !== config.MALICIOUS_SLASH_PERCENT) {
        deployer.logger.log("Setting malicious slash percent");
        await slasher.setMaliciousSlashPercent(
            new BN(config.MALICIOUS_SLASH_PERCENT)
        );
        actionCount++;
    }
    const secretRevealSlashPercent = new BN(
        await slasher.secretRevealSlashPercent.call()
    ).toNumber();
    if (secretRevealSlashPercent !== config.SECRET_REVEAL_SLASH_PERCENT) {
        deployer.logger.log("Setting secret reveal slash percent");
        await slasher.setSecretRevealSlashPercent(
            new BN(config.SECRET_REVEAL_SLASH_PERCENT)
        );
        actionCount++;
    }

    const currentSlasher = await darknodeRegistry.slasher.call();
    const nextSlasher = await darknodeRegistry.nextSlasher.call();
    if (
        Ox(currentSlasher) != Ox(DarknodeSlasher.address) &&
        Ox(nextSlasher) != Ox(DarknodeSlasher.address)
    ) {
        deployer.logger.log("Linking DarknodeSlasher and DarknodeRegistry");
        // Update slasher address
        await darknodeRegistry.updateSlasher(DarknodeSlasher.address);
        actionCount++;
    }

    /***************************************************************************
     ** DARKNODE PAYMENT *******************************************************
     **************************************************************************/
    if (!DarknodePaymentStore.address) {
        deployer.logger.log("Deploying DarknodePaymentStore");
        await deployer.deploy(DarknodePaymentStore, VERSION_STRING);
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
            config.DARKNODE_PAYOUT_PERCENT // Reward payout percentage (50% is paid out at any given cycle)
        );
        actionCount++;
    }

    // Update darknode payment address
    if (
        Ox(await darknodeRegistry.darknodePayment()) !==
        Ox(DarknodePayment.address)
    ) {
        deployer.logger.log("Updating DarknodeRegistry's darknode payment");
        await darknodeRegistry.updateDarknodePayment(DarknodePayment.address);
        actionCount++;
    }

    const darknodePayment = await DarknodePayment.at(DarknodePayment.address);
    for (const tokenName of Object.keys(tokens)) {
        const tokenAddress = tokens[tokenName];
        const registered =
            (
                await darknodePayment.registeredTokenIndex.call(tokenAddress)
            ).toString() !== "0";
        const pendingRegistration = await darknodePayment.tokenPendingRegistration.call(
            tokenAddress
        );
        if (!registered && !pendingRegistration) {
            deployer.logger.log(
                `Registering token ${tokenName} in DarknodePayment`
            );
            await darknodePayment.registerToken(tokenAddress);
            actionCount++;
        }
    }

    const dnrInDarknodePayment = await darknodePayment.darknodeRegistry.call();
    if (Ox(dnrInDarknodePayment) !== Ox(darknodeRegistry.address)) {
        deployer.logger.log("Updating DNR in DNP");
        await darknodePayment.updateDarknodeRegistry(darknodeRegistry.address);
        actionCount++;
    }

    const darknodePaymentStore = await DarknodePaymentStore.at(
        DarknodePaymentStore.address
    );
    const currentOwner = await darknodePaymentStore.owner.call();
    if (Ox(currentOwner) !== Ox(DarknodePayment.address)) {
        deployer.logger.log("Linking DarknodePaymentStore and DarknodePayment");

        if (currentOwner === contractOwner) {
            await darknodePaymentStore.transferOwnership(
                DarknodePayment.address
            );

            // Update DarknodePaymentStore address
            deployer.logger.log(`Claiming DNPS ownership in DNP`);
            await darknodePayment.claimStoreOwnership();
        } else {
            deployer.logger.log(
                `Transferring DNPS ownership from ${currentOwner} to new DNP`
            );
            const oldDarknodePayment = await DarknodePayment.at(currentOwner);
            await oldDarknodePayment.transferStoreOwnership(
                DarknodePayment.address
            );
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
    if (
        Ox(await darknodePayment.cycleChanger()) !==
        Ox(darknodeRegistry.address)
    ) {
        deployer.logger.log("Setting the DarknodePayment's cycle changer");
        await darknodePayment.updateCycleChanger(darknodeRegistry.address);
        actionCount++;
    }

    deployer.logger.log(`Performed ${actionCount} updates.`);

    deployer.logger.log(`

        /* 1_darknodes.js */

        RenProxyAdmin: "${RenProxyAdmin.address}",
        RenToken: "${RenToken.address}",

        // Protocol
        ProtocolLogicV1: "${ProtocolLogicV1.address}",
        ProtocolProxy: "${ProtocolProxy.address}",
    
        // DNR
        DarknodeRegistryStore: "${DarknodeRegistryStore.address}",
        DarknodeRegistryLogicV1: "${DarknodeRegistryLogicV1.address}",
        DarknodeRegistryProxy: "${DarknodeRegistryProxy.address}",

        // DNP
        DarknodePaymentStore: "${DarknodePaymentStore.address}",
        DarknodePayment: "${DarknodePayment.address}",

        // Slasher
        DarknodeSlasher: "${DarknodeSlasher.address}",
    `);
};
