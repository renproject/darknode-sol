
var Token = artifacts.require("Token.sol");
// var Traders = artifacts.require("Traders");
var Nodes = artifacts.require("Nodes.sol");
var Utils = artifacts.require("Utils.sol");
var Config = require("../republic-config");
// var ECRecovery = artifacts.require("zeppelin-solidity/contracts/ECRecovery.sol");

module.exports = async function (deployer) {
  // deployer.deploy(ECRecovery);
  // deployer.link(ECRecovery, [Traders]);
  deployer.deploy(Utils);
  deployer.link(Utils, [/*Traders,*/ Nodes]);
  // deployer.deploy(Traders);

  deployer.deploy(Token).then(function () {
    deployer.link(Token, [Nodes]);
    return deployer.deploy(Nodes, Token.address, Config.shuffleTime, Config.bondMinimum);
  });
};