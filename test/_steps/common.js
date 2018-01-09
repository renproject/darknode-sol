
const utils = require("../test_utils");
const { accounts, indexMap } = require("../accounts");
var config = require("../../republic-config");

// Initialise:
let ren;
(async () => {
  ren = await artifacts.require("RepublicToken").deployed();
})();


const steps = {

  /** GetRenBalance */
  GetRenBalance: async (account) => {
    return await ren.balanceOf(account.address, { from: account.address });
  },

}

module.exports = steps;