
const utils = require("../_helpers/test_utils");
const config = require("../../republic-config");
const steps = require('./steps').steps;

const { accounts, indexMap } = require("../_helpers/accounts");

// Todo: put into config file
const MINIMUM_ORDER_FEE = 100000;

// Wait for contracts:
let orderBook, ren;
(async () => {
  ren = await artifacts.require("RepublicToken").deployed();
  await artifacts.require("MinerRegistrar").deployed();
  await artifacts.require("TraderRegistrar").deployed();
  orderBook = await artifacts.require("OrderBook").deployed();
})();


module.exports = {

  GenerateOrder: (fragmentCount) => {
    return {
      orderID: utils.randomHash(),
      fragmentIDs: (utils.range(fragmentCount)).map(i => utils.randomHash()),
    }
  },

  CombineFragments:
    (fragmentIDs_A, fragmentIDs_B) => (utils.range(fragmentIDs_A.length)).map(i => utils.randomBytes())
  ,

  RandomMNetwork:
    (mNetworks) => (mNetworks[1 + Math.floor(Math.random() * (mNetworks.length - 1))])
  ,

  CheckOrderFragments: (orderID, fragmentIDs, mNetwork) => { // async
    // Check orders fragments
    return Promise.all(mNetwork.map(
      (miner, i) => steps.CheckOrderFragment(orderID, fragmentIDs[i], miner)
    ));
  },

  CheckOrderFragment: async (orderID, fragmentId, miner) => {
    (await orderBook.checkOrderFragment.call(orderID, fragmentId, miner.republic))
      .should.be.true;
  },

  GetKValue:
    (fragmentCount) => (fragmentCount - 1) / 2 + 1
  ,

  SubmitOutputFragments: (outputFragments, orderID_A, orderID_B, mNetwork, fragmentIDs_A, fragmentIDs_B) => { // async
    // Submit order fragments
    const kValue = steps.GetKValue(outputFragments.length);
    return Promise.all(utils.range(kValue).map(
      i => steps.SubmitOutputFragment(outputFragments[i], orderID_A, orderID_B, mNetwork[i], fragmentIDs_A[i], fragmentIDs_B[i])
    ));
  },

  SubmitOutputFragment: async (outputFragment, orderID1, orderID2, miner, fragmentID1, fragmentID2) => {
    await utils.logTx("Submitting fragment", orderBook.submitOutputFragment(outputFragment, orderID1, orderID2, miner.republic, fragmentID1, fragmentID2, { from: miner.address }));
  },

  GetMatchedOrder: async (_orderID) => {
    const [orderID, traderID] = await orderBook.getMatchedOrder.call(_orderID);
    return { orderID, traderID };
  },

  OpenOrder: async (trader, orderId, fragmentIds, randomMNetwork, leaderNetwork) => {
    await steps.ApproveRen(/* from: */ trader, /* to: */ orderBook, MINIMUM_ORDER_FEE);
    const randomMNetworkIDs = randomMNetwork.map(account => account.republic);
    const leaderNetworkIDs = leaderNetwork.map(account => account.republic);
    await utils.logTx("Opening order", orderBook.openOrder(trader.republic, orderId, fragmentIds, randomMNetworkIDs, leaderNetworkIDs, { from: trader.address }));
  },

  WithdrawRewards: async (mNetwork) => {
    let sum = 0;
    for (let i = 0; i < mNetwork.length; i++) {
      // Do it in this direction in order to now have to require bignumber.js
      const reward = await orderBook.getReward.call(mNetwork[i].republic);
      sum = reward.add(sum);
    }
    await Promise.all(mNetwork.map(miner => steps.WithdrawReward(miner)));
    return sum;
  },

  WithdrawReward: async (miner) => {
    // TODO: Check Ren balance instead of getReward
    const reward = await orderBook.getReward(miner.republic);
    await utils.logTx("Withdrawing miner reward", orderBook.withdrawReward(miner.republic, { from: miner.address }));
    return reward;
  },

  OrdersDidMatch: async (orderID_A, trader_A, orderID_B, trader_B) => {
    const { orderID: matchedOrderID_A, traderID: matchedTraderID_A } = await steps.GetMatchedOrder(orderID_A);
    const { orderID: matchedOrderID_B, traderID: matchedTraderID_B } = await steps.GetMatchedOrder(orderID_B);

    return (matchedOrderID_A == orderID_B) &&
      (matchedOrderID_B == orderID_A) &&
      (matchedTraderID_A == trader_B.republic) &&
      (matchedTraderID_B == trader_A.republic);
  }

};
