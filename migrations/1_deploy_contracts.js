
var DarknodeRegistry = artifacts.require("DarknodeRegistry.sol");
var TraderWallet = artifacts.require("TraderWallet.sol");
var RepublicToken = artifacts.require("RepublicToken.sol");

const CONFIG = {
    REN: {
        address: "0x65d54eda5f032f2275caa557e50c029cfbccbb54",
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

function deployContract(deployer, artifact) {
    deployer.deploy(
        artifact,
    );
}

module.exports = function (deployer) {
    // deployDarknodeRegistry(deployer);
    deployContract(deployer, RepublicToken);
};