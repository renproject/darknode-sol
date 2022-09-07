/// <reference types="../types/truffle-contracts" />

const { execSync } = require("child_process");

const RenToken = artifacts.require("RenToken");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistryProxy = artifacts.require("DarknodeRegistryProxy");
const DarknodeRegistryLogicV2 = artifacts.require("DarknodeRegistryLogicV2");
const DarknodeRegistryV1ToV2Upgrader = artifacts.require(
    "DarknodeRegistryV1ToV2Upgrader"
);
const RenProxyAdmin = artifacts.require("RenProxyAdmin");

const networks = require("./networks.js");

const { encodeCallData } = require("./encode");

const NULL = "0x0000000000000000000000000000000000000000";

const gitCommit = () =>
    execSync("git describe --always --long").toString().trim();

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
module.exports = async function (deployer, network) {
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
    DarknodeRegistryProxy.address = addresses.DarknodeRegistryProxy || "";
    DarknodeRegistryLogicV2.address = addresses.DarknodeRegistryLogicV2 || "";
    DarknodeRegistryStore.address = addresses.DarknodeRegistryStore || "";
    RenProxyAdmin.address = addresses.RenProxyAdmin || "";
    DarknodeRegistryV1ToV2Upgrader.address =
        addresses.DarknodeRegistryV1ToV2Upgrader || "";

    const slasher = NULL;

    let actionCount = 0;

    /** PROXY ADMIN ***********************************************************/
    if (!RenProxyAdmin.address) {
        deployer.logger.log("Deploying Proxy ");
        await deployer.deploy(RenProxyAdmin);
        actionCount++;
    }
    let renProxyAdmin = await RenProxyAdmin.at(RenProxyAdmin.address);

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

    if (!DarknodeRegistryLogicV2.address) {
        deployer.logger.log("Deploying DarknodeRegistryLogicV2");
        await deployer.deploy(DarknodeRegistryLogicV2);
    }
    const darknodeRegistryLogic = await DarknodeRegistryLogicV2.at(
        DarknodeRegistryLogicV2.address
    );
    const darknodeRegistryParameters = {
        types: [
            "string",
            "address",
            "address",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
        ],
        values: [
            VERSION_STRING,
            RenToken.address,
            DarknodeRegistryStore.address,
            config.MINIMUM_BOND.toString(),
            config.MINIMUM_POD_SIZE,
            config.MINIMUM_EPOCH_INTERVAL_SECONDS,
            0,
        ],
    };

    // Initialize darknodeRegistryLogic so others can't initialize it.
    const darknodeRegistryLogicOwner = await darknodeRegistryLogic.owner();
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
    const darknodeRegistry = await DarknodeRegistryLogicV2.at(
        DarknodeRegistryProxy.address
    );

    const darknodeRegistryProxyLogic =
        await renProxyAdmin.getProxyImplementation(
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

    const storeOwner = await darknodeRegistryStore.owner();
    if (Ox(storeOwner) !== Ox(darknodeRegistry.address)) {
        deployer.logger.log(
            "Linking DarknodeRegistryStore and DarknodeRegistry"
        );
        if (Ox(storeOwner) === Ox(contractOwner)) {
            // Initiate ownership transfer of DNR store
            const pendingOwner = await darknodeRegistryStore.pendingOwner();
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
            const oldDNR = await DarknodeRegistryLogicV2.at(storeOwner);
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

    const renInDNR = await darknodeRegistry.ren();
    if (Ox(renInDNR) !== Ox(RenToken.address)) {
        console.error(
            `ERROR! DNR is pointing to wrong REN token - ${Ox(
                renInDNR
            )} instead of ${Ox(
                RenToken.address
            )} - DNR should be updated or redeployed.`
        );
    }

    const renInDNRS = await darknodeRegistryStore.ren();
    if (Ox(renInDNRS) !== Ox(RenToken.address)) {
        console.error(
            `ERROR! DNRS is pointing to wrong REN token - ${Ox(
                renInDNRS
            )} instead of ${Ox(
                RenToken.address
            )} - DNRS should be updated or redeployed.`
        );
    }

    // const currentSlasher = await darknodeRegistry.slasher();
    // const nextSlasher = await darknodeRegistry.nextSlasher();
    // if (Ox(currentSlasher) != Ox(slasher) && Ox(nextSlasher) != Ox(slasher)) {
    //     deployer.logger.log("Linking DarknodeSlasher and DarknodeRegistry");
    //     // Update slasher address
    //     await darknodeRegistry.updateSlasher(slasher);
    //     actionCount++;
    // }

    if (!DarknodeRegistryV1ToV2Upgrader.address) {
        await deployer.deploy(
            DarknodeRegistryV1ToV2Upgrader,
            renProxyAdmin.address,
            darknodeRegistry.address,
            darknodeRegistryLogic.address
        );
        actionCount++;
    }

    deployer.logger.log(`Performed ${actionCount} updates.`);

    deployer.logger.log(`
        RenProxyAdmin: "${RenProxyAdmin.address}",
        RenToken: "${RenToken.address}",
        DarknodeRegistryStore: "${DarknodeRegistryStore.address}",
        DarknodeRegistryLogicV2: "${DarknodeRegistryLogicV2.address}",
        DarknodeRegistryProxy: "${DarknodeRegistryProxy.address}",
        DarknodeRegistryV1ToV2Upgrader: "${DarknodeRegistryV1ToV2Upgrader.address}",
    `);
};
