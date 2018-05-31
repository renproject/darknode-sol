
var DarknodeRegistry = artifacts.require("DarknodeRegistry.sol");
var TraderAccount = artifacts.require("TraderAccount.sol");
// var RepublicToken = artifacts.require("RepublicToken.sol");

// Put any configs here
const CONFIG = {
    REN: {
        // TODO: Detect network
        // address: "0x65d54eda5f032f2275caa557e50c029cfbccbb54", // ROPSTEN
        address: "0x596F8c39aEc9fb72D0F591DEe4408516f4C9DdA4", // KOVAN
    },
    DNR: {
        minimumBond: 0, // in airen
        minimumPoolSize: 5,
        minumumEpochInterval: 60, // in seconds
    }
};

function deployDarknodeRegistry(deployer) {
    deployer.deploy(
        DarknodeRegistry,
        CONFIG.REN.address,
        CONFIG.DNR.minimumBond,
        CONFIG.DNR.minimumPoolSize,
        CONFIG.DNR.minumumEpochInterval
    );
}

// Deploys a contract with no parmeters
function deployContract(deployer, artifact) {
    deployer.deploy(
        artifact,
    );
}

module.exports = function (deployer) {
    // deployDarknodeRegistry(deployer);
    // deployContract(deployer, TraderAccount);
};