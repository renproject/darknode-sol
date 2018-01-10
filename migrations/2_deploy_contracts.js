
var RepublicToken = artifacts.require("RepublicToken.sol");
// var Traders = artifacts.require("Traders");
var MinerRegistrar = artifacts.require("MinerRegistrar.sol");
var TraderRegistrar = artifacts.require("TraderRegistrar.sol");
var OrderBook = artifacts.require("OrderBook.sol");
var Utils = artifacts.require("Utils.sol");
var Config = require("../republic-config");
// var ECRecovery = artifacts.require("zeppelin-solidity/contracts/ECRecovery.sol");

module.exports = function (deployer) {
  // deployer.deploy(ECRecovery);
  // deployer.link(ECRecovery, [Traders]);
  deployer.deploy(Utils);
  deployer.link(Utils, [MinerRegistrar, TraderRegistrar]);
  // deployer.deploy(Traders);

  return deployer.deploy(RepublicToken).then(() => {
    deployer.link(RepublicToken, [MinerRegistrar, TraderRegistrar]);
    return deployer.deploy(MinerRegistrar, RepublicToken.address, Config.epochInterval, Config.bondMinimum).then(() => {
      return deployer.deploy(TraderRegistrar, RepublicToken.address, Config.bondMinimum).then(() => {
        return deployer.deploy(OrderBook, RepublicToken.address, MinerRegistrar.address, TraderRegistrar.address)
      })
    })
  });
};