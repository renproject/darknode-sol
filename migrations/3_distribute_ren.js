
const { accounts } = require("../test/testrpc_accounts.js");

module.exports = async function (deployer) {
  ren = await artifacts.require("RepublicToken").deployed();

  console.log("Sharing around REN tokens...");
  return await Promise.all(accounts.map(account => ren.transfer(account.address, 10000)));
};