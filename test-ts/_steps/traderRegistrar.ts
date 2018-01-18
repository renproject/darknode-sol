
import { artifacts, assert } from "../../truffle";
import { Account } from "../../types";

const { accounts, indexMap } = require("../_helpers/accounts");

const config = require("../../republic-config");
import steps from "./steps";
import * as utils from "../_helpers/test_utils";

// Wait for contracts:
let traderRegistrar: any, ren: any;
(async () => {
  ren = await artifacts.require("RepublicToken").deployed();
  traderRegistrar = await artifacts.require("TraderRegistrar").deployed();
})();

module.exports = {

  /** Register */
  RegisterTrader: async (account: any, bond: number) => {
    assert(bond > 0, "Registration bond must be positive");
    await ren.approve(traderRegistrar.address, bond, { from: account.address });

    // TODO: Generate signature
    const tx = await utils.logTx(
      "Registering",
      traderRegistrar.register(account.public, account.public, { from: account.address })
    );

    // // Verify event
    // utils.assertEventsEqual(tx.logs[tx.logs.length - 1],
    //   { event: 'TraderRegistered', traderId: account.republic, bond: bond });
  },

  GetTraderCount: async () => {
    return await traderRegistrar.getTraderCount.call();
  },

  /** Deregister */
  DeregisterTrader: async (account: Account) => {
    const tx = await utils.logTx(
      "Deregistering",
      traderRegistrar.deregister(account.republic, { from: account.address })
    );
  },

  /** GetBond */
  GetTraderBond: async (account: Account) => {
    // TODO: CHange to call
    return await traderRegistrar.getBond(account.republic, { from: account.address });
  },

  /** ApproveRen */
  ApproveRenToTraderRegistrar: async (account: Account, amount: number) => {
    return await ren.approve(traderRegistrar.address, amount, { from: account.address });
  },

  /** UpdateBond */
  UpdateTraderBond: async (account: Account, newBond: number) => {
    const tx = await utils.logTx(
      "Updating bond",
      traderRegistrar.updateBond(account.republic, newBond, { from: account.address })
    );

    // Verify event
    // utils.assertEventsEqual(tx.logs[0],
    //   { event: 'TraderBondUpdated', traderId: account.republic, newBond: newBond });
  },

  WithdrawTraderBond: async (account: Account) => {
    return await utils.logTx(
      "Releasing bond",
      traderRegistrar.withdrawBond(account.republic, { from: account.address })
    );
  },

  /** GetPublicKey */
  GetTraderPublicKey: async (republicAddr: string) => {
    return await traderRegistrar.getPublicKey(republicAddr);
  },
};
