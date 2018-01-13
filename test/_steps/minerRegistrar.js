
const { accounts, indexMap } = require("../_helpers/accounts");

const config = require("../../republic-config");
const steps = require('./steps').steps;
const utils = require("../_helpers/test_utils");

// Wait for contracts:
let minerRegistrar, ren;
(async () => {
  ren = await artifacts.require("RepublicToken").deployed();
  minerRegistrar = await artifacts.require("MinerRegistrar").deployed();
})();


module.exports = {

  WaitForEpoch: async () => {
    while (true) {
      // Must be an on-chain call, or the time won't be updated
      const tx = await utils.logTx('Checking epoch', minerRegistrar.checkEpoch());
      // If epoch happened, return
      if (tx.logs.length > 0 && tx.logs[tx.logs.length - 1].event === "NextEpoch") {
        return;
      }

      await utils.sleep(config.epochInterval * 0.1);
    }
  },

  GetEpochBlockhash: async () => {
    return await minerRegistrar.getEpochBlockhash.call()
  },

  GetCurrentMinerCount: async () => {
    return await minerRegistrar.getCurrentMinerCount.call()
  },

  GetRegisteredMiners: async () => {

    const count = await steps.GetCurrentMinerCount();
    const split = 50;
    const indexes = utils.range(Math.floor(count / split) + 1);
    const starts = indexes.map(index => index * split);
    const ends = indexes.map(index => Math.min((index + 1) * split, count));

    const miners = [];
    const l1 = await indexes
      .map(i => minerRegistrar.getCurrentMiners(starts[i], ends[i]))
      .reduce(async (acc, curr) => { return (await acc).concat(await curr) }, Array(0));
    // const l2 = await minerRegistrar.getCurrentMiners(0, count);

    // l1.should.deep.equal(l2);

    return l1;
  },

  GetAllMiners: async () => {
    return await minerRegistrar.getAllMiners()
  },

  GetRegisteredAccountIndexes: async () => {
    const miners = await steps.GetRegisteredMiners();
    return miners.map(miner => indexMap[miner]);
  },


  /** MINER SPECIFIC FUNCTIONS */

  /** Register */
  RegisterMiner: async (account, bond) => {
    assert(bond > 0, "Registration bond must be positive");
    const difference = bond - (await minerRegistrar.getBondPendingWithdrawal(account.republic));
    if (difference) {
      await ren.approve(minerRegistrar.address, difference, { from: account.address });
    }
    // TODO: Generate signature
    const tx = await utils.logTx('Registering', minerRegistrar.register(account.public, account.public, { from: account.address }));

    // Verify event
    // utils.assertEventsEqual(tx.logs[tx.logs.length - 1],
    //   { event: 'MinerRegistered', minerId: account.republic, bond: bond });
  },

  /** Deregister */
  DeregisterMiner: async (account) => {
    const tx = await utils.logTx('Deregistering', minerRegistrar.deregister(account.republic, { from: account.address }));
    // Verify event
    // const log = tx.logs[0];
    // assert(log.event == 'MinerDeregistered');
    // assert(log.args["minerId"] == account.republic);
  },

  /** GetBond */
  GetMinerBond: async (account) => {
    return await minerRegistrar.getBond.call(account.republic)
  },

  GetMinerSeed: async (account) => {
    return await minerRegistrar.getSeed.call(account.republic)
  },

  /** getMNetworkSize */
  GetMNetworkSize: async () => {
    return await minerRegistrar.getMNetworkSize.call()
  },

  /*** Expected Pool Count ***/
  ExpectedMNetworkCount: (count) => {
    // TODO: Use contract getter instead
    return Math.ceil(Math.log2(count)) - 1
  },

  /** GetRenBalance */
  GetRenBalance: async (account) => {
    return await ren.balanceOf(account.address, { from: account.address })
  },

  // AssertPoolDistributions

  /** ApproveRenToMinerRegistrar */
  ApproveRenToMinerRegistrar: async (account, amount) => {
    return await ren.approve(minerRegistrar.address, amount, { from: account.address })
  },

  /** UpdateBond */
  UpdateMinerBond: async (account, newBond) => {
    tx = await utils.logTx('Updating bond', minerRegistrar.updateBond(account.republic, newBond, { from: account.address }));

    // Verify event
    // utils.assertEventsEqual(tx.logs[0],
    //   { event: 'MinerBondUpdated', minerId: account.republic, newBond: newBond });
  },

  WithdrawMinerBond: async (account) => {
    return await utils.logTx('Releasing bond', minerRegistrar.withdrawBond(account.republic, { from: account.address }))
  },

  /** GetPublicKey */
  GetMinerPublicKey: async (republicAddr) => {
    return await minerRegistrar.getPublicKey(republicAddr)
  },



  /** FUNCTIONS FOR ALL ACCOUNTS */

  GetAllMiners: async () => {
    return await minerRegistrar.getAllMiners.call()
  },

  WithdrawAllMinerBonds: async (accounts) => {
    await Promise.all(accounts.map(
      account => steps.WithdrawMinerBond(account)
    ));
  },

  /** Register all accounts */
  RegisterAllMiners: async (accounts, bond) => {
    await Promise.all(accounts.map(
      account => steps.RegisterMiner(account, bond)
    ));
  },

  /** Deregister all accounts */
  DeregisterAllMiners: async (accounts) => {
    await Promise.all(accounts.map(
      account => steps.DeregisterMiner(account)
    ));
  },


  /**
   * Sort the miners into MNetworks by keccak256(epoch blockhash + miner's precommited seed)
   */
  GetMNetworks: async () => {
    const miners = await steps.GetRegisteredMiners();
    const epochHash = await steps.GetEpochBlockhash();
    // Get miner seeds
    norms = {};
    await Promise.all(miners.map(async (miner, i) => {
      const seed = await steps.GetMinerSeed({ republic: miner });
      norms[miner] = web3.sha3(seed + epochHash);
    }));
    // Sort miners by epoch blockhash and their norm
    miners.sort(
      (a, b) => norms[a] - norms[b]
    );

    const a = await steps.GetCurrentMinerCount() // miners.length;
    const N = await minerRegistrar.getMNetworkSize();
    const p = Math.ceil(a / N);

    const mNetworks = [];
    for (let i = 0; i < p; i++) { mNetworks.push([]); }

    for (let i = 0; i < a; i++) {
      const mIndex = i % p;
      const account = accounts[indexMap[miners[i]]];
      mNetworks[mIndex].push(account);
    }

    return mNetworks;
  }

}