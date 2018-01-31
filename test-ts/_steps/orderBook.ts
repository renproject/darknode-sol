
import * as utils from "../_helpers/test_utils";
import { accounts, indexMap } from "../_helpers/accounts";
import steps from "./steps";
import { BigNumber } from "bignumber.js";

const config = require("../../republic-config");

// Todo: put into config file
const MINIMUM_ORDER_FEE = 100000;

// Wait for contracts:
// tslint:disable-next-line:no-any
let orderBook: any, ren: any;
(async (): Promise<void> => {
  ren = await artifacts.require("RepublicToken").deployed();
  await artifacts.require("MinerRegistrar").deployed();
  await artifacts.require("TraderRegistrar").deployed();
  orderBook = await artifacts.require("OrderBook").deployed();
})();

module.exports = {

  GenerateOrder: (fragmentCount: number) => {
    return {
      orderID: utils.randomHash(),
      fragmentIDs: (utils.range(fragmentCount)).map(i => utils.randomHash()),
    };
  },

  CombineFragments: (fragmentIDs_A: string[], fragmentIDs_B: string[]) =>
    (utils.range(fragmentIDs_A.length)).map(i => utils.randomBytes())
  ,

  RandomMNetwork:
    (mNetworks: Account[][]) => (mNetworks[1 + Math.floor(Math.random() * (mNetworks.length - 1))])
  ,

  CheckOrderFragments: async (orderID: string, fragmentIDs: string[], mNetwork: MNetwork[]): Promise<void> => { // async
    // Check orders fragments
    for (let i = 0; i < mNetwork.length; i++) {
      const miner = mNetwork[i];
      await steps.CheckOrderFragment(orderID, fragmentIDs[i], miner);
    }
    // return Promise.all(mNetwork.map(
    //   (miner, i) => steps.CheckOrderFragment(orderID, fragmentIDs[i], miner)
    // ));
  },

  CheckOrderFragment: async (orderID: string, fragmentId: string, miner: Account): Promise<void> => {
    (await orderBook.checkOrderFragment.call(orderID, fragmentId, miner.republic))
      .should.be.true;
  },

  GetKValue:
    (fragmentCount: number) => (fragmentCount - 1) / 2 + 1
  ,

  SubmitOutputFragments: async (
    outputFragments: string[],
    orderID_A: string,
    orderID_B: string,
    mNetwork: Account[], fragmentIDs_A: string[], fragmentIDs_B: string[]): Promise<void> => { // async
    // Submit order fragments
    const kValue = steps.GetKValue(outputFragments.length);
    for (let i = 0; i < kValue; i++) {
      await steps.SubmitOutputFragment(
        outputFragments[i], orderID_A, orderID_B,
        mNetwork[i], fragmentIDs_A[i], fragmentIDs_B[i]
      );
    }
    // return Promise.all(utils.range(kValue).map(
    //   i => steps.SubmitOutputFragment(outputFragments[i],
    //        orderID_A, orderID_B, mNetwork[i], fragmentIDs_A[i], fragmentIDs_B[i])
    // ));
  },

  SubmitOutputFragment: async (
    outputFragment: string[], orderID1: string, orderID2: string,
    miner: Account, fragmentID1: string, fragmentID2: string): Promise<void> => {
    await utils.logTx(
      "Submitting fragment",
      orderBook.submitOutputFragment(
        outputFragment, orderID1, orderID2, miner.republic,
        fragmentID1, fragmentID2, { from: miner.address })
    );
  },

  GetMatchedOrder: async (_orderID: string): Promise<{ orderID: string, traderID: string }> => {
    const [orderID, traderID] = await orderBook.getMatchedOrder.call(_orderID);
    return { orderID, traderID };
  },

  OpenOrder: async (
    trader: Account, orderId: string, fragmentIds: string[],
    randomMNetwork: Account[], leaderNetwork: Account[]) => {
    await ren.approve(orderBook.address, MINIMUM_ORDER_FEE, { from: trader.address });
    // await steps.ApproveRen(/* from: */ trader, /* to: */ orderBook, MINIMUM_ORDER_FEE);
    const randomMNetworkIDs = randomMNetwork.map(account => account.republic);
    const leaderNetworkIDs = leaderNetwork.map(account => account.republic);
    await utils.logTx(
      "Opening order",
      orderBook.openOrder(
        trader.republic, orderId, fragmentIds, randomMNetworkIDs,
        leaderNetworkIDs, { from: trader.address }
      )
    );
  },

  WithdrawRewards: async (mNetwork: MNetwork): Promise<BigNumber> => {
    let sum = new BigNumber(0);
    for (let i = 0; i < mNetwork.length; i++) {
      // Do it in this direction in order to now have to require bignumber.js
      const reward = await orderBook.getReward.call(mNetwork[i].republic);
      sum = sum.add(reward);
      await steps.WithdrawReward(mNetwork[i]);
    }
    // await Promise.all(mNetwork.map(miner => steps.WithdrawReward(miner)));
    return sum;
  },

  WithdrawReward: async (miner: Account): Promise<BigNumber> => {
    // TODO: Check Ren balance instead of getReward
    const reward = await orderBook.getReward(miner.republic);
    await utils.logTx("Withdrawing miner reward", orderBook.withdrawReward(miner.republic, { from: miner.address }));
    return reward;
  },

  OrdersDidMatch: async (orderID_A: string, trader_A: Account, orderID_B: string, trader_B: Account) => {
    const { orderID: matchedOrderID_A, traderID: matchedTraderID_A } = await steps.GetMatchedOrder(orderID_A);
    const { orderID: matchedOrderID_B, traderID: matchedTraderID_B } = await steps.GetMatchedOrder(orderID_B);

    return (matchedOrderID_A === orderID_B) &&
      (matchedOrderID_B === orderID_A) &&
      (matchedTraderID_A === trader_B.republic) &&
      (matchedTraderID_B === trader_A.republic);
  }

};
