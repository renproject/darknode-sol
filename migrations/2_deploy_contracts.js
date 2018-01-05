
var RepublicToken = artifacts.require("RepublicToken.sol");
// var Traders = artifacts.require("Traders");
var Registrar = artifacts.require("Registrar.sol");
var Utils = artifacts.require("Utils.sol");
var Config = require("../republic-config");
// var ECRecovery = artifacts.require("zeppelin-solidity/contracts/ECRecovery.sol");

module.exports = async function (deployer) {
  // deployer.deploy(ECRecovery);
  // deployer.link(ECRecovery, [Traders]);
  deployer.deploy(Utils);
  deployer.link(Utils, [/*Traders,*/ Registrar]);
  // deployer.deploy(Traders);

  deployer.deploy(RepublicToken).then(function () {
    deployer.link(RepublicToken, [Registrar]);
    return deployer.deploy(Registrar, RepublicToken.address, Config.epochInterval, Config.bondMinimum);
  });
};