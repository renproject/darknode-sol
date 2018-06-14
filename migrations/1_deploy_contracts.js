
var DarknodeRegistry = artifacts.require("DarknodeRegistry.sol");
var RenLedger = artifacts.require("RenLedger.sol");
var RenExBalances = artifacts.require("RenExBalances.sol");
var RenExTokens = artifacts.require("RenExTokens.sol");
var RenExSettlement = artifacts.require("RenExSettlement.sol");
// var RepublicToken = artifacts.require("RepublicToken.sol");

// Put any configs here
const CONFIG = {
    REN: {
        // TODO: Detect network
        // address: "0x65d54eda5f032f2275caa557e50c029cfbccbb54", // ROPSTEN
        address: "0xDB5a619B65feDD4171fB05671C62d188a1650496", // KOVAN
    },
    DGX: {
        // TODO: Detect network
        // address: "0x65d54eda5f032f2275caa557e50c029cfbccbb54", // ROPSTEN
        address: "0x13b185974a93b05eb380e3c5cbd6b67b7dd8ae35", // KOVAN
    },
    DNR: {
        minimumBond: 0, // in airen
        minimumPoolSize: 5,
        minumumEpochInterval: 1, // in seconds,
        address: "0x9979cd31b0de1f495a4f53d64039e5f69ff06e15",
    },
    Ledger: {
        address: "0x51dE68D7767DBa16A21ADE748849e67E765e063C" // KOVAN
    },
    RenExTokens: {
        address: "0x45bca0ddc49415c45ac8d3cdc0b793e0c3324f25",
    },
    RenExBalances: {
        address: "0x5bc537A67F782ae0ae154B6fcB6dB6ebE1B77313",
    },
    RenExSettlement: {
        address: "0xdebe9b6e1f4b29ffa472694ad1befc5309e72f89",
    },
};

async function deployDarknodeRegistry(deployer) {
    await deployer.deploy(
        DarknodeRegistry,
        CONFIG.REN.address,
        CONFIG.DNR.minimumBond,
        CONFIG.DNR.minimumPoolSize,
        CONFIG.DNR.minumumEpochInterval
    );
    return await DarknodeRegistry.deployed();
}

async function deployRenLedger(deployer, dnr) {
    await deployer.deploy(
        RenLedger,
        0,
        CONFIG.REN.address,
        dnr,
    );
    return await RenLedger.deployed();
}


async function deployRenExSettlement(deployer, ledger, tokenContract, renExBalances) {
    await deployer.deploy(
        RenExSettlement,
        ledger,
        tokenContract,
        renExBalances,
    );
    return await RenExSettlement.deployed();
}


// Deploys a contract with no parmeters
async function deployContract(deployer, artifact) {
    const contract = await deployer.deploy(
        artifact,
    );
    return await artifact.deployed();
}

module.exports = async function (deployer) {
    // const dnr = await deployDarknodeRegistry(deployer);
    const dnr = DarknodeRegistry.at(CONFIG.DNR.address);
    // const ledger = await deployRenLedger(deployer, dnr.address);
    const ledger = RenLedger.at(CONFIG.Ledger.address);

    // // // RENEXTOKENS
    // const renExTokens = await deployContract(deployer, RenExTokens);
    // await renExTokens.registerToken(1, 0x0, 18);
    // await renExTokens.registerToken(0x100, CONFIG.DGX.address, 9);
    // await renExTokens.registerToken(0x10000, CONFIG.REN.address, 18);

    // const renExBalances = await deployContract(deployer, RenExBalances);

    const renExTokens = RenExTokens.at(CONFIG.RenExTokens.address);
    const renExBalances = RenExBalances.at(CONFIG.RenExBalances.address);

    console.log(ledger.address);
    console.log(renExTokens.address);
    console.log(renExBalances.address);

    const renExSettlement = await deployRenExSettlement(deployer, ledger.address, renExTokens.address, renExBalances.address);
    // const renExSettlement = CONFIG.RenExSettlement.address;

    await renExBalances.setRenExSettlementContract(renExSettlement.address);
};
