
const utils = require("../test_utils");
const { accounts, indexMap } = require("../accounts");
var config = require("../../republic-config");

// Initialise:
let ren;
(async () => {
  ren = await artifacts.require("RepublicToken").deployed();
})();

var steps = require('./steps').steps;

const commonSteps = {

  ApproveRen: // async
    // from and to must match interface {address: ...}
    (from, to, amount) => ren.approve(to.address, amount, { from: from.address })
  ,

  /** GetRenBalance */
  GetRenBalance: async (account) => {
    return await ren.balanceOf(account.address, { from: account.address });
  },

}

module.exports = { commonSteps };