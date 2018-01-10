
const utils = require("../test_utils");
const { accounts, indexMap } = require("../accounts");
var config = require("../../republic-config");

// Initialise:
let ren, traderRegistrar;
(async () => {
  ren = await artifacts.require("RepublicToken").deployed();
  traderRegistrar = await artifacts.require("TraderRegistrar").deployed();
})();


const steps = {

  /** Register */
  Register: async (account, bond) => {
    await ren.approve(traderRegistrar.address, bond, { from: account.address });
    const tx = await utils.logTx('Registering', traderRegistrar.register(account.public, { from: account.address }));

    // // Verify event
    // utils.assertEventsEqual(tx.logs[tx.logs.length - 1],
    //   { event: 'TraderRegistered', traderId: account.republic, bond: bond });
  },

  GetTraderCount: async () => {
    return await traderRegistrar.getTraderCount.call();
  },

  /** Deregister */
  Deregister: async (account) => {
    const tx = await utils.logTx('Deregistering', traderRegistrar.deregister(account.republic, { from: account.address }));
  },

  /** GetBond */
  GetBond: async (account) => {
    // TODO: CHange to call
    return await traderRegistrar.getBond(account.republic, { from: account.address });
  },

  /** GetRenBalance */
  GetRenBalance: async (account) => {
    return await ren.balanceOf(account.address, { from: account.address });
  },

  /** ApproveRen */
  ApproveRen: async (amount, account) => {
    ren.approve(traderRegistrar.address, amount, { from: account.address });
  },

  /** UpdateBond */
  UpdateBond: async (account, newBond) => {
    tx = await utils.logTx('Updating bond', traderRegistrar.updateBond(account.republic, newBond, { from: account.address }));

    // Verify event
    // utils.assertEventsEqual(tx.logs[0],
    //   { event: 'TraderBondUpdated', traderId: account.republic, newBond: newBond });
  },

  WithdrawBond: async (account) => {
    return await utils.logTx('Releasing bond', traderRegistrar.withdrawBond(account.republic, { from: account.address }));
  },

  /** GetPublicKey */
  GetPublicKey: async (republicAddr) => {
    return await traderRegistrar.getPublicKey(republicAddr);
  },
}

module.exports = steps;