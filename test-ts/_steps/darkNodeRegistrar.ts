
import { accounts, indexMap } from "../_helpers/accounts";
// import { DarkNodeRegistrarInstance } from "../../contracts";

const config = require("../../republic-config");
import steps from "./steps";
import * as utils from "../_helpers/test_utils";
import { Transaction } from "web3";
import { BigNumber } from "bignumber.js";

// Wait for contracts:
// tslint:disable-next-line:no-any
let darkNodeRegistrar: any, ren: any;
(async (): Promise<void> => {
  ren = await artifacts.require("RepublicToken").deployed();
  darkNodeRegistrar = await artifacts.require("DarkNodeRegistrar").deployed();
})();

module.exports = {

  WaitForEpoch: async (): Promise<void> => {
    while (true) {
      // Must be an on-chain call, or the time won't be updated
      const tx = await utils.logTx("Checking epoch", darkNodeRegistrar.epoch());
      // If epoch happened, return
      if (tx.logs.length > 0 && tx.logs[tx.logs.length - 1].event === "NewEpoch") {
        return;
      }

      await utils.sleep(config.epochInterval * 0.1);
    }
  },

  GetEpochBlockhash: async (): Promise<string> => {
    return (await darkNodeRegistrar.getCurrentEpoch.call()).blockhash;
  },

  GetCurrentDarkNodeCount: async (): Promise<BigNumber> => {
    return await darkNodeRegistrar.getNumberOfDarkNodes.call();
  },

  GetRegisteredDarkNodes: async (): Promise<Account[]> => {

    const count = await steps.GetCurrentDarkNodeCount();
    const split = 50;
    const indexes = utils.range(Math.floor(count / split) + 1);
    const starts = indexes.map((index: number) => index * split);
    const ends = indexes.map((index: number) => Math.min((index + 1) * split, count));

    const darkNodes = [];
    const l1: Account[] = await indexes
      .map((i: number) => darkNodeRegistrar.getCurrentDarkNodes(starts[i], ends[i]))
      .reduce(
      async (acc: Promise<Account[]>, curr: Promise<Account>) => {
        return (await acc).concat(await curr);
      },
      Array(0));
    // const l2 = await darkNodeRegistrar.getCurrentDarkNodes(0, count);

    // l1.should.deep.equal(l2);

    return l1;
  },

  GetRegisteredAccountIndexes: async (): Promise<number[]> => {
    const darkNodes = await steps.GetRegisteredDarkNodes();
    return darkNodes.map((darkNode: string) => indexMap[darkNode]);
  },

  /** MINER SPECIFIC FUNCTIONS */

  /** Register */
  RegisterDarkNode: async (account: Account, bond: number): Promise<any> => {
    assert(bond > 0, "Registration bond must be positive");
    await ren.approve(darkNodeRegistrar.address, bond, { from: account.address });
    // TODO: Generate signature
    const tx = await utils.logTx(
      "Registering",
      darkNodeRegistrar.register(account.republic, account.public, { from: account.address })
    );

    // Verify event
    // utils.assertEventsEqual(tx.logs[tx.logs.length - 1],
    //   { event: 'DarkNodeRegistered', darkNodeId: account.republic, bond: bond });
  },

  /** Deregister */
  DeregisterDarkNode: async (account: Account): Promise<any> => {
    const tx = await utils.logTx(
      "Deregistering",
      darkNodeRegistrar.deregister(account.republic, { from: account.address })
    );
    return tx;
    // Verify event
    // const log = tx.logs[0];
    // assert(log.event == 'DarkNodeDeregistered');
    // assert(log.args["darkNodeId"] == account.republic);
  },

  /** GetBond */
  GetDarkNodeBond: async (account: Account): Promise<any> => {
    return await darkNodeRegistrar.getBond.call(account.republic);
  },

  /** Get darkNode ID from ethereum address */
  GetDarkNodeID: async (account: Account): Promise<any> => {
    return await darkNodeRegistrar.getDarkNodeID.call(account.address);
  },

  GetDarkNodeSeed: async (account: Account): Promise<any> => {
    return await darkNodeRegistrar.getSeed.call(account.republic);
  },

  /** getMNetworkSize */
  GetAllDarkNodes: async (): Promise<any> => {
    const [darkNodeList, deregisteredCount, toDeregisterCount,
      stayingRegisteredCount, toRegisterCount] = await darkNodeRegistrar.getAllDarkNodes.call();
    const deregisteredOffset = 1;
    const toDeregisterOffset = deregisteredOffset + deregisteredCount.toNumber(); // 1 + 5 = 6
    const registeredOffset = toDeregisterOffset + toDeregisterCount.toNumber();
    const toRegisterOffset = registeredOffset + stayingRegisteredCount.toNumber();
    const end = toRegisterOffset + toRegisterCount.toNumber();
    console.log(`slice(${deregisteredOffset}, ${toDeregisterOffset}`);
    return {
      deregistered: darkNodeList.slice(deregisteredOffset, toDeregisterOffset),
      toDeregister: darkNodeList.slice(toDeregisterOffset, registeredOffset),
      registered: darkNodeList.slice(registeredOffset, toRegisterOffset),
      toRegister: darkNodeList.slice(toRegisterOffset, end),
    };
  },

  /** getMNetworkSize */
  GetMNetworkSize: async (): Promise<any> => {
    return await darkNodeRegistrar.getMNetworkSize.call();
  },

  // GetMNetworkCount: async (): Promise<any> => {
  //   return await darkNodeRegistrar.getMNetworkCount.call()
  // },

  /*** Expected Pool Count ***/
  // ExpectedMNetworkCount: (count) => {
  //   // TODO: Use contract getter instead
  //   return Math.ceil(Math.log2(count)) - 1
  // },

  /** GetRenBalance */
  GetRenBalance: async (account: Account): Promise<any> => {
    return await ren.balanceOf(account.address, { from: account.address });
  },

  // AssertPoolDistributions

  /** ApproveRenToDarkNodeRegistrar */
  ApproveRenToDarkNodeRegistrar: async (account: Account, amount: number): Promise<any> => {
    return await ren.approve(darkNodeRegistrar.address, amount, { from: account.address });
  },

  /** UpdateBond */
  UpdateDarkNodeBond: async (account: Account, newBond: number): Promise<any> => {
    const tx = await utils.logTx(
      "Updating bond",
      darkNodeRegistrar.updateBond(account.republic, newBond, { from: account.address })
    );

    // Verify event
    // utils.assertEventsEqual(tx.logs[0],
    //   { event: 'DarkNodeBondUpdated', darkNodeId: account.republic, newBond: newBond });
  },

  WithdrawDarkNodeBond: async (account: Account): Promise<any> => {
    return await utils.logTx(
      "Releasing bond",
      darkNodeRegistrar.refund(account.republic, { from: account.address })
    );
  },

  /** GetPublicKey */
  GetDarkNodePublicKey: async (account: Account): Promise<any> => {
    return await darkNodeRegistrar.getPublicKey(account.republic);
  },

  /** FUNCTIONS FOR ALL ACCOUNTS */

  WithdrawDarkNodeBonds: async (_accounts: Account[]): Promise<any> => {
    for (let i = 0; i < _accounts.length; i++) {
      await steps.WithdrawDarkNodeBond(_accounts[i]);
    }
    // await Promise.all(_accounts.map(
    //   account => steps.WithdrawDarkNodeBond(account)
    // ));
  },

  /** Register all accounts */
  RegisterDarkNodes: async (_accounts: Account[], bond: number): Promise<any> => {
    for (let i = 0; i < _accounts.length; i++) {
      await steps.RegisterDarkNode(_accounts[i], bond);
    }
    // await Promise.all(_accounts.map(
    //   account => steps.RegisterDarkNode(account, bond)
    // ));
  },

  /** Deregister all accounts */
  DeregisterDarkNodes: async (_accounts: Account[]): Promise<any> => {
    for (let i = 0; i < _accounts.length; i++) {
      await steps.DeregisterDarkNode(_accounts[i]);
    }
    // await Promise.all(_accounts.map(
    //   account => steps.DeregisterDarkNode(account)
    // ));
  },

  /**
   * Sort the darkNodes into MNetworks by keccak256(epoch blockhash + darkNode's precommited seed)
   */
  GetMNetworks: async (): Promise<MNetwork[]> => {
    const darkNodes = await steps.GetRegisteredDarkNodes();
    const epochHash = await steps.GetEpochBlockhash();

    // Get darkNode seeds
    const norms: any = {};
    // await Promise.all(darkNodes.map(async (darkNode, i) => {
    //   const seed = await steps.GetDarkNodeSeed({ republic: darkNode });
    //   norms[darkNode] = web3.sha3(seed + epochHash);
    // }));
    for (let i = 0; i < darkNodes.length; i++) {
      const darkNode = darkNodes[i];
      const seed = await steps.GetDarkNodeSeed({ republic: darkNode });
      norms[darkNode] = web3.sha3(seed + epochHash);
    }

    // Sort darkNodes by epoch blockhash and their norm
    darkNodes.sort(
      (m_a: any, m_b: any) => norms[m_a] - norms[m_b]
    );

    const a = await steps.GetCurrentDarkNodeCount(); // darkNodes.length;
    const N = await darkNodeRegistrar.getMNetworkSize();
    const p = Math.ceil(a / N);

    const mNetworks = [];
    for (let i = 0; i < p; i++) { mNetworks.push([]); }

    for (let i = 0; i < a; i++) {
      const mIndex = i % p;
      const account = accounts[indexMap[darkNodes[i]]];
      mNetworks[mIndex].push(account);
    }

    return mNetworks;
  }

};