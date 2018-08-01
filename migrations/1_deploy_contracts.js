const BigNumber = require("bignumber.js");

const RepublicToken = artifacts.require("RepublicToken.sol");
const DarknodeRegistry = artifacts.require("DarknodeRegistry.sol");
const Orderbook = artifacts.require("Orderbook.sol");
const RewardVault = artifacts.require("RewardVault.sol");

const BOND = 100000 * 1e18;
const INGRESS_FEE = 0;
const POD_SIZE = 3; // 24 in production
const EPOCH_BLOCKS = 1; // 14400 in production

module.exports = async function (deployer, network) {
    await deployer
        .deploy(
            RepublicToken, { overwrite: network !== "f0" }
        )
        .then(() => deployer.deploy(
            DarknodeRegistry,
            RepublicToken.address,
            new BigNumber(BOND),
            POD_SIZE,
            EPOCH_BLOCKS,
        ))

        .then(() => deployer.deploy(
            Orderbook,
            INGRESS_FEE,
            RepublicToken.address,
            DarknodeRegistry.address,
        ))

        .then(() => deployer.deploy(
            RewardVault, DarknodeRegistry.address
        ));
};
