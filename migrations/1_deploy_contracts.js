
var DarknodeRegistry = artifacts.require("DarknodeRegistry.sol");
var Orderbook = artifacts.require("Orderbook.sol");
var RenExBalances = artifacts.require("RenExBalances.sol");
var RewardVault = artifacts.require("RewardVault.sol");
var RenExTokens = artifacts.require("RenExTokens.sol");
var RenExSettlement = artifacts.require("RenExSettlement.sol");

var RepublicToken = artifacts.require("RepublicToken.sol");
var DGXMock = artifacts.require("DGXMock.sol");
var ABCToken = artifacts.require("ABCToken.sol");
var XYZToken = artifacts.require("XYZToken.sol");

let migration = async function (deployer, network) {
    // Network is "development", "nightly", "falcon" or "f0"

    // REN
    await deployer
        .deploy(
            RepublicToken, { overwrite: network !== "f0" }
        )
        .then(() => deployer.deploy(
            DGXMock, { overwrite: network !== "f0" })
        )
        .then(() => deployer.deploy(
            ABCToken, { overwrite: network !== "f0" })
        )
        .then(() => deployer.deploy(
            XYZToken, { overwrite: network !== "f0" })
        )

        .then(() => deployer.deploy(
            DarknodeRegistry,
            RepublicToken.address,
            100000 * 1e18, // Bond
            6, // Pod
            600, // Epoch
        ))


        .then(() => deployer.deploy(
            Orderbook,
            0, // Fee
            RepublicToken.address,
            DarknodeRegistry.address,
        ))

        .then(() => deployer.deploy(
            RewardVault, DarknodeRegistry.address
        ))

        .then(() => deployer.deploy(
            RenExTokens,
            { overwrite: network !== "f0" },
        ))

        .then(async () => {
            const renExTokens = RenExTokens.at(RenExTokens.address);
            await renExTokens.registerToken(1, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", 18);
            await renExTokens.registerToken(0x100, DGXMock.address, 9);
            await renExTokens.registerToken(0x10000, RepublicToken.address, 18);
            await renExTokens.registerToken(0x10001, ABCToken.address, 12);
            await renExTokens.registerToken(0x10002, XYZToken.address, 18);
        })

        .then(() => deployer.deploy(
            RenExBalances, RewardVault.address,
            { overwrite: network !== "f0" },
        ))

        .then(() => {
            const GWEI = 1000000000;
            return deployer.deploy(
                RenExSettlement,
                Orderbook.address,
                RenExTokens.address,
                RenExBalances.address,
                100 * GWEI,
            );
        })

        .then(async () => {
            const renExBalances = RenExBalances.at(RenExBalances.address);
            await renExBalances.updateRewardVault(RewardVault.address);
            await renExBalances.updateRenExSettlementContract(RenExSettlement.address);
        });
};

module.exports = (deployer, network) => {
    migration(deployer, network).catch((err) => { console.error(err); throw err; });
};