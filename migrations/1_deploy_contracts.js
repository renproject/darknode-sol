
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


let migration = async function (deployer) {
    // REN
    await deployer.deploy(RepublicToken);
    // RepublicToken.address = "0x...";

    // DGX
    await deployer.deploy(DGXMock);
    // DGXMock.address = "0x...";

    // ABC
    await deployer.deploy(ABCToken);
    // ABCToken.address = "0x...";

    // XYZ
    await deployer.deploy(XYZToken);
    // XYZToken.address = "0x...";

    // DNR
    await deployer.deploy(
        DarknodeRegistry,
        RepublicToken.address,
        0,
        3,
        240,
    );
    // DarknodeRegistry.address = "0x...";


    // Orderbook
    await await deployer.deploy(
        Orderbook,
        0,
        RepublicToken.address,
        DarknodeRegistry.address,
    );
    // Orderbook.address = "0x...";

    // RewardVault
    await deployer.deploy(RewardVault, DarknodeRegistry.address);
    // RewardVault.address = "0x...";

    // RenExTokens
    await deployer.deploy(
        RenExTokens,
    );
    const renExTokens = RenExTokens.at(RenExTokens.address);
    await renExTokens.registerToken(1, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", 18);
    await renExTokens.registerToken(0x100, DGXMock.address, 9);
    await renExTokens.registerToken(0x10000, RepublicToken.address, 18);
    await renExTokens.registerToken(0x10001, ABCToken.address, 12);
    await renExTokens.registerToken(0x10002, XYZToken.address, 18);
    // RenExTokens.address = "0x...";

    // RenExBalances (1/2)
    await deployer.deploy(RenExBalances, RewardVault.address);
    // RenExBalances.address = "0x...";

    // RenExSettlement
    await deployer.deploy(
        RenExSettlement,
        Orderbook.address,
        RenExTokens.address,
        RenExBalances.address,
    );
    // RenExSettlement.address = "0x...";

    // RenExBalances (2/2)
    const renExBalances = RenExBalances.at(RenExBalances.address);
    await renExBalances.setRenExSettlementContract(RenExSettlement.address);
};

// Comment to run deployment:
migration = (deployer) => null;

module.exports = migration;