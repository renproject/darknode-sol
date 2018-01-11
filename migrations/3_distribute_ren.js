
const { accounts } = require("../test/accounts");

module.exports = function (deployer) {
  return artifacts.require("RepublicToken").deployed().then((ren) => {
    console.log("Sharing around REN tokens...");
    return Promise.all(accounts.map(account => ren.transfer(account.address, 1000000)));
  });
};