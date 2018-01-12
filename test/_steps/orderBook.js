
const utils = require("../test_utils");
const config = require("../../republic-config");
const steps = require('./steps').steps;

const { accounts, indexMap } = require("../accounts");

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

  CheckOrderFragment: async (orderID, fragmentId, miner) => {
    (await orderBook.checkOrderFragment.call(orderID, fragmentId, miner.republic))
      .should.be.true;
  },

  SubmitOutputFragment: async (outputFragment, orderID1, orderID2, miner, fragmentID1, fragmentID2) => {
    await orderBook.submitOutputFragment(outputFragment, orderID1, orderID2, miner.republic, fragmentID1, fragmentID2, { from: miner.address });
  },

  GetMatchedOrder: async (_orderID) => {
    const [orderID, traderID] = await orderBook.getMatchedOrder.call(_orderID);
    return { orderID, traderID };
  },

  OpenOrder: async (trader, orderId, fragmentIds, randomMNetwork, leaderNetwork) => {
    await steps.ApproveRen(/* from: */ trader, /* to: */ orderBook, MINIMUM_ORDER_FEE);
    const randomMNetworkIDs = randomMNetwork.map(account => account.republic);
    const leaderNetworkIDs = leaderNetwork.map(account => account.republic);
    await orderBook.openOrder(trader.republic, orderId, fragmentIds, randomMNetworkIDs, leaderNetworkIDs, { from: trader.address });
  },

  WithdrawReward:
    (miner) => orderBook.withdrawReward(miner.republic, { from: miner.address })
  ,

  OrdersDidMatch: async (orderID_A, trader_A, orderID_B, trader_B) => {
    const { orderID: matchedOrderID_A, traderID: matchedTraderID_A } = await steps.GetMatchedOrder(orderID_A);
    const { orderID: matchedOrderID_B, traderID: matchedTraderID_B } = await steps.GetMatchedOrder(orderID_B);

    return (matchedOrderID_A == orderID_B) &&
      (matchedOrderID_B == orderID_A) &&
      (matchedTraderID_A == trader_B.republic) &&
      (matchedTraderID_B == trader_A.republic);
  }

};
