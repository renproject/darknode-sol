
var DarkNodeRegistry = artifacts.require("DarknodeRegistry.sol");

const CONFIG = {
    renAddress: "0x65d54eda5f032f2275caa557e50c029cfbccbb54",
    minimumBond: 0, // in airen
    minimumPoolSize: 5,
    minumumEpochInterval: 60, // in seconds
};

module.exports = function (deployer) {
    deployer.deploy(
        DarkNodeRegistry,
        CONFIG.renAddress,
        CONFIG.minimumBond,
        CONFIG.minimumPoolSize,
        CONFIG.minumumEpochInterval
    );
};