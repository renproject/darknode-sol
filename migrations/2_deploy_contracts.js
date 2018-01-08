
var RepublicToken = artifacts.require("RepublicToken.sol");
// var Traders = artifacts.require("Traders");
var MinerRegistrar = artifacts.require("MinerRegistrar.sol");
var TraderRegistrar = artifacts.require("TraderRegistrar.sol");
var Utils = artifacts.require("Utils.sol");
var Config = require("../republic-config");
// var ECRecovery = artifacts.require("zeppelin-solidity/contracts/ECRecovery.sol");

module.exports = function (deployer) {
  // deployer.deploy(ECRecovery);
  // deployer.link(ECRecovery, [Traders]);
  deployer.deploy(Utils);
  deployer.link(Utils, [MinerRegistrar, TraderRegistrar]);
  // deployer.deploy(Traders);

  deployer.deploy(RepublicToken).then(async function () {
    deployer.link(RepublicToken, [MinerRegistrar, TraderRegistrar]);
    // deployer.deploy(TraderRegistrar, RepublicToken.address, Config.bondMinimum);
    return deployer.deploy(MinerRegistrar, RepublicToken.address, Config.epochInterval, Config.bondMinimum);
  });
};