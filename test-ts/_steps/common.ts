
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

  ApproveRen: async (from: Account, to: Account, amount: number): Promise<any> => {
    // from and to must match interface {address: ...}
    return await ren.approve(to.address, amount, { from: from.address });
  },

  /** GetRenBalance */
  GetRenBalance: async (account: Account): Promise<any> => {
    return await ren.balanceOf(account.address, { from: account.address });
  },

};