var Migrations = artifacts.require("./migrations/Migrations.sol");

module.exports = function(deployer) {
  deployer.deploy(Migrations);
};
