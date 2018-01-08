
const utils = require("../test_utils");
const { accounts, indexMap } = require("../accounts");
var config = require("../../republic-config");

// Initialise:
let ren, minerRegistrar;
(async () => {
  ren = await artifacts.require("RepublicToken").deployed();
  minerRegistrar = await artifacts.require("MinerRegistrar").deployed();
})();


const steps = {

  /** Register */
  Register: async (account, bond) => {
    const difference = bond - (await minerRegistrar.getBondPendingWithdrawal(account.republic));
    if (difference) {
      await ren.approve(minerRegistrar.address, difference, { from: account.address });
    }
    const tx = await utils.logTx('Registering', minerRegistrar.register(account.public, { from: account.address }));

    // epochInterval = epochInterval || 1 * utils.days;

    // Verify event
    utils.assertEventsEqual(tx.logs[tx.logs.length - 1],
      { event: 'MinerRegistered', minerId: account.republic, bond: bond });
  },

  /** Register all accounts */
  RegisterAll: async (accounts, bond) => {
    await Promise.all(accounts.map(async account => {
      await ren.approve(minerRegistrar.address, bond, { from: account.address });
      utils.logTx('Registering', await minerRegistrar.register(account.public, { from: account.address }));
    }));
  },

  /** Deregister all accounts */
  DeregisterAll: async (accounts) => {
    await Promise.all(accounts.map(async account => {
      await minerRegistrar.deregister(account.republic, { from: account.address })
    }));
  },

  WaitForEpoch: async () => {
    while (true) {
      // Must be an on-chain call, or the time won't be updated
      const tx = await utils.logTx('Checking epoch', minerRegistrar.checkEpoch());
      // If epoch happened, return
      if (tx.logs.length > 0 && tx.logs[tx.logs.length - 1].event === "Epoch") { return; }

      await utils.sleep(config.epochInterval * 0.1);
    }
  },

  GetMinerCount: async () => {
    return await minerRegistrar.getMinerCount.call();
  },

  GetRegisteredMiners: async () => {
    return (await minerRegistrar.getCurrentMiners());
  },

  GetAllMiners: async () => {
    return (await minerRegistrar.getAllMiners());
  },

  GetRegisteredAccounts: async () => {
    const miners = await steps.GetRegisteredMiners();
    return miners.map(miner => indexMap[miner]);
  },

  GetAllPools: async (accounts) => {
    return Promise.all(accounts.map(async account => (await minerRegistrar.getPool(account.republic, { from: account.address })).toNumber()));
  },

  /** Deregister */
  Deregister: async (account) => {
    const tx = await utils.logTx('Deregistering', minerRegistrar.deregister(account.republic, { from: account.address }));
    // Verify event
    // const log = tx.logs[0];
    // assert(log.event == 'MinerDeregistered');
    // assert(log.args["minerId"] == account.republic);
  },

  /** GetBond */
  GetBond: async (account) => {
    // TODO: CHange to call
    return await minerRegistrar.getBond(account.republic, { from: account.address });
  },

  /** GetPool */
  GetPool: async (account) => {
    // TODO: CHange to call
    return await minerRegistrar.getPool(account.republic, { from: account.address });
  },

  GetAllMiners: async () => {
    return await minerRegistrar.getAllMiners.call();
  },

  /** GetPoolCount */
  GetPoolSize: async () => {
    return await minerRegistrar.getPoolSize.call();
  },

  /*** Expected Pool Count ***/
  ExpectedPoolCount: (count) => {
    return Math.ceil(Math.log2(count)) - 1;
  },

  /** GetRenBalance */
  GetRenBalance: async (account) => {
    return await ren.balanceOf(account.address, { from: account.address });
  },

  // AssertPoolDistributions

  /** ApproveRen */
  ApproveRen: async (amount, account) => {
    ren.approve(minerRegistrar.address, amount, { from: account.address });
  },

  /** UpdateBond */
  UpdateBond: async (account, newBond) => {
    tx = await utils.logTx('Updating bond', minerRegistrar.updateBond(account.republic, newBond, { from: account.address }));

    // Verify event
    // utils.assertEventsEqual(tx.logs[0],
    //   { event: 'MinerBondUpdated', minerId: account.republic, newBond: newBond });
  },

  WithdrawBond: async (account) => {
    return await utils.logTx('Releasing bond', minerRegistrar.withdrawBond(account.republic, { from: account.address }));
  },

  /** GetPublicKey */
  GetPublicKey: async (republicAddr) => {
    return await minerRegistrar.getPublicKey(republicAddr);
  },
}

module.exports = steps;