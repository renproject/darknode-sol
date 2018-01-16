
const utils = require("../_helpers/test_utils");
const config = require("../../republic-config");
const steps = require('./steps').steps;

const { accounts, indexMap } = require("../_helpers/accounts");

// Wait for contracts:
let ren;
(async () => {
  ren = await artifacts.require("RepublicToken").deployed();
})();


module.exports = {

  ApproveRen: async (from, to, amount) => {
    // from and to must match interface {address: ...}
    return await ren.approve(to.address, amount, { from: from.address });
  },

  /** GetRenBalance */
  GetRenBalance: async (account) => {
    return await ren.balanceOf(account.address, { from: account.address });
  },

}