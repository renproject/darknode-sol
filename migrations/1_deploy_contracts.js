const BigNumber = require("bignumber.js");

const RepublicToken = artifacts.require("RepublicToken.sol");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore.sol");
const DarknodeRegistry = artifacts.require("DarknodeRegistry.sol");
const Orderbook = artifacts.require("Orderbook.sol");
const DarknodeRewardVault = artifacts.require("DarknodeRewardVault.sol");

const BOND = 100000 * 1e18;
const INGRESS_FEE = 0;
const POD_SIZE = 3; // 24 in production
const EPOCH_BLOCKS = 1; // 14400 in production
const SLASHER = 0x0;

module.exports = async function (deployer, network) {
await deployer
    .deploy(
        RepublicToken, { overwrite: network !== "f0" }
    )
    .then(() => deployer.deploy(
        DarknodeRegistryStore,
        RepublicToken.Address,
    ))
    .then(() => deployer.deploy(
        DarknodeRegistry,
        RepublicToken.address,
        DarknodeRegistryStore.address,
        new BigNumber(BOND),
        POD_SIZE,
        EPOCH_BLOCKS
    ))
}