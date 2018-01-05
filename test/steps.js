
const utils = require("./test_utils");
const accounts = require("./testrpc_accounts");
var config = require("../republic-config");

// Initialise:
let ren, registrar;
(async () => {
  ren = await artifacts.require("RepublicToken").deployed();
  registrar = await artifacts.require("Registrar").deployed();
})();


const steps = {

  /** Register */
  Register: async (account, bond) => {
    const difference = bond - (await registrar.getBondPendingRelease(account.republic));
    if (difference) {
      await ren.approve(registrar.address, difference, { from: account.address });
    }
    const tx = await utils.logTx('Registering', registrar.register(account.public, { from: account.address }));

    // epochInterval = epochInterval || 1 * utils.days;

    // Verify event
    utils.assertEventsEqual(tx.logs[tx.logs.length - 1],
      { event: 'MinerRegistered', minerId: account.republic, bond: bond });
  },

  /** Register all accounts */
  RegisterAll: async (accounts, bond) => {
    await Promise.all(accounts.map(async account => {
      await ren.approve(registrar.address, bond, { from: account.address });
      await registrar.register(account.public, { from: account.address });
    }));
  },

  /** Deregister all accounts */
  DeregisterAll: async (accounts) => {
    await Promise.all(accounts.map(async account => {
      await registrar.deregister(account.republic, { from: account.address })
    }));
  },

  WaitForEpoch: async () => {
    while (true) {
      // Must be an on-chain call, or the time won't be updated
      const tx = await utils.logTx('Checking epoch', registrar.checkEpoch());
      // If epoch happened, return
      if (tx.logs.length > 0 && tx.logs[tx.logs.length - 1].event === "Epoch") { return; }

      await utils.sleep(config.epochInterval * 0.1);
    }
  },

  GetMinerCount: async () => {
    return await registrar.getMinerCount.call();
  },

  GetRegisteredMiners: async (accounts) => {
    return (await registrar.getCurrentMiners());
  },

  GetAllMiners: async (accounts) => {
    return (await registrar.getAllMiners());
  },

  GetAllPools: async (accounts) => {
    return Promise.all(accounts.map(async account => (await registrar.getPool(account.republic, { from: account.address })).toNumber()));
  },

  /** Deregister */
  Deregister: async (account) => {
    const tx = await utils.logTx('Deregistering', registrar.deregister(account.republic, { from: account.address }));
    // Verify event
    // const log = tx.logs[0];
    // assert(log.event == 'MinerDeregistered');
    // assert(log.args["minerId"] == account.republic);
  },

  /** GetBond */
  GetBond: async (account) => {
    // TODO: CHange to call
    return await registrar.getBond(account.republic, { from: account.address });
  },

  /** GetPool */
  GetPool: async (account) => {
    // TODO: CHange to call
    return await registrar.getPool(account.republic, { from: account.address });
  },

  GetAllMiners: async () => {
    return await registrar.getAllMiners.call();
  },

  /** GetPoolCount */
  GetPoolSize: async () => {
    return await registrar.getPoolSize.call();
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
    ren.approve(registrar.address, amount, { from: account.address });
  },

  /** UpdateBond */
  UpdateBond: async (account, newBond) => {
    tx = await utils.logTx('Updating bond', registrar.updateBond(account.republic, newBond, { from: account.address }));

    // Verify event
    // utils.assertEventsEqual(tx.logs[0],
    //   { event: 'MinerBondUpdated', minerId: account.republic, newBond: newBond });
  },

  ReleaseBond: async (account) => {
    return await utils.logTx('Releasing bond', registrar.releaseBond(account.republic, { from: account.address }));
  },

  /** GetPublicKey */
  GetPublicKey: async (republicAddr) => {
    return await registrar.getPublicKey(republicAddr);
  },
}

module.exports = steps;