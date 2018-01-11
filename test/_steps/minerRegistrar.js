
const { accounts, indexMap } = require("../accounts");

const config = require("../../republic-config");
const steps = require('./steps').steps;
const utils = require("../test_utils");

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

  GetEpochBlockhash:
    () => minerRegistrar.getEpochBlockhash.call()
  ,

  GetCurrentMinerCount: // async
    () => minerRegistrar.getCurrentMinerCount.call()
  ,

  GetRegisteredMiners: // async
    () => minerRegistrar.getCurrentMiners()
  ,

  GetAllMiners: // async
    () => minerRegistrar.getAllMiners()
  ,

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
  GetMinerBond: // async
    account => minerRegistrar.getBond.call(account.republic)
  ,

  GetMinerSeed:
    account => minerRegistrar.getSeed.call(account.republic)
  ,

  /** getMNetworkSize */
  GetMNetworkSize: // async
    () => minerRegistrar.getMNetworkSize.call()
  ,

  /*** Expected Pool Count ***/
  ExpectedMNetworkCount: // TODO: Use contract getter instead
    (count) => Math.ceil(Math.log2(count)) - 1
  ,

  /** GetRenBalance */
  GetRenBalance: // async
    (account) => ren.balanceOf(account.address, { from: account.address })
  ,

  // AssertPoolDistributions

  /** ApproveRenToMinerRegistrar */
  ApproveRenToMinerRegistrar: // async
    (account, amount) => ren.approve(minerRegistrar.address, amount, { from: account.address })
  ,

  /** UpdateBond */
  UpdateMinerBond: async (account, newBond) => {
    tx = await utils.logTx('Updating bond', minerRegistrar.updateBond(account.republic, newBond, { from: account.address }));

    // Verify event
    // utils.assertEventsEqual(tx.logs[0],
    //   { event: 'MinerBondUpdated', minerId: account.republic, newBond: newBond });
  },

  WithdrawMinerBond:
    account => utils.logTx('Releasing bond', minerRegistrar.withdrawBond(account.republic, { from: account.address }))
  ,

  /** GetPublicKey */
  GetMinerPublicKey:
    republicAddr => minerRegistrar.getPublicKey(republicAddr)
  ,



  /** FUNCTIONS FOR ALL ACCOUNTS */

  GetAllMiners: // async
    () => minerRegistrar.getAllMiners.call()
  ,

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
    await Promise.all(miners.map(async (miner) => {
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