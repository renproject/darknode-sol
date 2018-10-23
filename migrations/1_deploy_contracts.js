const Web3 = require("web3");

const RepublicToken = artifacts.require("RepublicToken");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");
const Orderbook = artifacts.require("Orderbook");
const DarknodeRewardVault = artifacts.require("DarknodeRewardVault");
const SettlementRegistry = artifacts.require("SettlementRegistry");

const config = require("./config.js");

module.exports = async function (deployer, network, accounts) {
    ((global)).web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

    const {
        Logger,
        AppProject,
        Contracts,
        ImplementationDirectory,
        Package
    } = require("zos-lib");

    // On-chain, single entry point of the entire application.
    const log = new Logger('republic-sol');
    console.log(`<< Setting up App >> network: ${network}`);
    const initialVersion = '0.0.1';

    const project = await AppProject.fetchOrDeploy('republic-sol', initialVersion, {
        from: accounts[0],
    }, {});

    return project;

    // const VERSION_STRING = `${network}-${config.VERSION}`;

    // await deployer
    //     .deploy(RepublicToken)
    //     .then(() => deployer.deploy(
    //         DarknodeRegistryStore,
    //         VERSION_STRING,
    //         RepublicToken.address,
    //     ))
    //     .then(() => deployer.deploy(
    //         DarknodeRegistry,
    //         VERSION_STRING,
    //         RepublicToken.address,
    //         DarknodeRegistryStore.address,
    //         config.MINIMUM_BOND,
    //         config.MINIMUM_POD_SIZE,
    //         config.MINIMUM_EPOCH_INTERVAL
    //     ))
    //     .then(() => deployer.deploy(
    //         SettlementRegistry,
    //         VERSION_STRING,
    //     ))
    //     .then(() => deployer.deploy(
    //         Orderbook,
    //         VERSION_STRING,
    //         DarknodeRegistry.address,
    //         SettlementRegistry.address,
    //     ))
    //     .then(() => deployer.deploy(
    //         DarknodeRewardVault,
    //         VERSION_STRING,
    //         DarknodeRegistry.address
    //     ))
    //     .then(async () => {
    //         // Initiate ownership transfer of DNR store 
    //         const darknodeRegistryStore = await DarknodeRegistryStore.at(DarknodeRegistryStore.address);
    //         await darknodeRegistryStore.transferOwnership(DarknodeRegistry.address);

    //         // // Claim ownership
    //         // const darknodeRegistry = await DarknodeRegistry.at(DarknodeRegistry.address);
    //         // await darknodeRegistry.claimStoreOwnership();
    //     })
    //     .then(() => deployer.deploy(
    //         DarknodeSlasher,
    //         VERSION_STRING,
    //         DarknodeRegistry.address,
    //         Orderbook.address,
    //     ))
    //     .then(async () => {
    //         const darknodeRegistry = await DarknodeRegistry.at(DarknodeRegistry.address);
    //         await darknodeRegistry.updateSlasher(DarknodeSlasher.address);
    //     });
}