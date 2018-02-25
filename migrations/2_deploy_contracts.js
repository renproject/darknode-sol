
var RepublicToken = artifacts.require("RepublicToken.sol");
var DarkNodeRegistrar = artifacts.require("DarkNodeRegistrar.sol");
var TraderRegistrar = artifacts.require("TraderRegistrar.sol");
var Utils = artifacts.require("Utils.sol");
var Config = require("../republic-config");

module.exports = function (deployer) {
  deployer.deploy(Utils);
  deployer.link(Utils, [DarkNodeRegistrar, TraderRegistrar]);

  return deployer.deploy(RepublicToken).then(() => {
    deployer.link(RepublicToken, [DarkNodeRegistrar, TraderRegistrar]);
    return deployer.deploy(DarkNodeRegistrar, RepublicToken.address, Config.bondMinimum, Config.epochInterval).then(() => {
      return deployer.deploy(TraderRegistrar, RepublicToken.address, Config.bondMinimum)
    })
  });
};