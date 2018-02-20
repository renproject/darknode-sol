
var RepublicToken = artifacts.require("RepublicToken.sol");
// var Traders = artifacts.require("Traders");
var DarkNodeRegistrar = artifacts.require("DarkNodeRegistrar.sol");
var TraderRegistrar = artifacts.require("TraderRegistrar.sol");
// var OrderBook = artifacts.require("OrderBook.sol");
var Utils = artifacts.require("Utils.sol");
var Config = require("../republic-config");
// var ECRecovery = artifacts.require("zeppelin-solidity/contracts/ECRecovery.sol");

module.exports = function (deployer) {
  // deployer.deploy(ECRecovery);
  // deployer.link(ECRecovery, [Traders]);
  deployer.deploy(Utils);
  deployer.link(Utils, [DarkNodeRegistrar, TraderRegistrar]);
  // deployer.deploy(Traders);

  return deployer.deploy(RepublicToken).then(() => {
    deployer.link(RepublicToken, [DarkNodeRegistrar, TraderRegistrar]);
    return deployer.deploy(DarkNodeRegistrar, RepublicToken.address, Config.bondMinimum, Config.epochInterval).then(() => {
      return deployer.deploy(TraderRegistrar, RepublicToken.address, Config.bondMinimum)
      // .then(() => {
      //   return deployer.deploy(OrderBook, RepublicToken.address, DarkNodeRegistrar.address, TraderRegistrar.address)
      // })
    })
  });
};