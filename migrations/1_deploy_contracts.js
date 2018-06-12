
var DarknodeRegistry = artifacts.require("DarknodeRegistry.sol");
var RenLedger = artifacts.require("RenLedger.sol");
var TraderAccounts = artifacts.require("TraderAccounts.sol");
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
        minumumEpochInterval: 60, // in seconds,
        address: "0x2877a4eab06d0cea08f12db55cdb57e110632934",
    },
    Ledger: {
        address: "0x972da720da8607363f5875659c75aede8fd734d2" // KOVAN
    },
    Accounts: {
        address: "0xdcb3d500fd230b59ab8f9f39181554c7ddc0f30a",
    }
};

async function deployDarknodeRegistry(deployer) {
    await deployer.deploy(
        DarknodeRegistry,
        CONFIG.REN.address,
        CONFIG.DNR.minimumBond,
        CONFIG.DNR.minimumPoolSize,
        CONFIG.DNR.minumumEpochInterval
    );
    const dnr = await DarknodeRegistry.deployed();
    return dnr.address;
}

async function deployRenLedger(deployer, dnr) {
    await deployer.deploy(
        RenLedger,
        0,
        CONFIG.REN.address,
        dnr,
    );
    const ledger = await RenLedger.deployed();
    return ledger.address;
}


async function deployTraderAccount(deployer, ledger) {
    await deployer.deploy(
        TraderAccounts,
        ledger,
    );
    const accounts = await TraderAccounts.deployed();
    await accounts.registerToken(1, 0x0, 18);
    await accounts.registerToken(0x100, CONFIG.DGX.address, 9);
    await accounts.registerToken(0x10000, CONFIG.REN.address, 18);
}


// // Deploys a contract with no parmeters
// function deployContract(deployer, artifact) {
//     deployer.deploy(
//         artifact,
//     );
// }

module.exports = async function (deployer) {
    // const dnr = await deployDarknodeRegistry(deployer);
    const dnr = CONFIG.DNR.address;
    // const ledger = await deployRenLedger(deployer, dnr);
    const ledger = CONFIG.Ledger.address;
    await deployTraderAccount(deployer, ledger);
    // deployContract(deployer, TraderAccounts);
};
