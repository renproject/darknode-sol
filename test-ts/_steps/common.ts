
import { artifacts } from "../../truffle";
import * as utils from "../_helpers/test_utils";
const config = require("../../republic-config");
import steps from "./steps";

import { accounts, indexMap } from "../_helpers/accounts";

// Wait for contracts:
let ren: any;
(async () => {
  ren = await artifacts.require("RepublicToken").deployed();
})();

export default {

  ApproveRen: async (from: any, to: any, amount: number) => {
    // from and to must match interface {address: ...}
    return await ren.approve(to.address, amount, { from: from.address });
  },

  /** GetRenBalance */
  GetRenBalance: async (account: any) => {
    return await ren.balanceOf(account.address, { from: account.address });
  },

};