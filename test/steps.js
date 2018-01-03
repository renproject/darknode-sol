
const utils = require("./test_utils");
const accounts = require("./testrpc_accounts");
var config = require("../republic-config");

// Initialise:
let ren, registrar;
(async () => {
  ren = await artifacts.require("Token").deployed();
  registrar = await artifacts.require("Nodes").deployed();
})();


const steps = {

  /** Register */
  Register: async (account, bond) => {
    const tx = await utils.logTx('Registering',
      ren.approve(registrar.address, bond, { from: account.address }),
      registrar.register(account.public, { from: account.address })
    );

    // shuffleTime = shuffleTime || 1 * utils.days;

    // Verify event
    utils.assertEventsEqual(tx.logs[tx.logs.length - 1],
      { event: 'NodeRegistered', nodeId: account.republic, bond: bond });
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

  AwaitShuffleTime: async () => {
    return await utils.sleep(config.shuffleTime * 1.1);
  },

  CheckEpoch: async () => {
    return await registrar.checkEpoch();
  },

  WaitForEpoch: async () => {
    await steps.AwaitShuffleTime();
    return await steps.CheckEpoch();
  },

  GetNodeCount: async () => {
    return await registrar.getNodeCount.call();
  },

  GetRegisteredNodes: async (accounts) => {
    return (await registrar.getCurrentNodes());
  },

  GetAllPools: async (accounts) => {
    return Promise.all(accounts.map(async account => (await registrar.getPool(account.republic, { from: account.address })).toNumber()));
  },

  /** Deregister */
  Deregister: async (account) => {
    const tx = await utils.logTx('Deregistering', registrar.deregister(account.republic, { from: account.address }));
    // Verify event
    const log = tx.logs[0];
    assert(log.event == 'NodeDeregistered');
    assert(log.args["nodeId"] == account.republic);
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

  GetAllNodes: async () => {
    return await registrar.getAllNodes.call();
  },

  /** GetPoolCount */
  GetPoolCount: async () => {
    return await registrar.getPoolCount.call();
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
    utils.assertEventsEqual(tx.logs[0],
      { event: 'NodeBondUpdated', nodeId: account.republic, newBond: newBond });
  },

  /** GetPublicKey */
  GetPublicKey: async (republicAddr) => {
    return await registrar.getPublicKey(republicAddr);
  },
}

module.exports = steps;