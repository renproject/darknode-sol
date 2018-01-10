
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

  CheckOrderFragment: async (orderID, fragmentId, account) => {
    const check = await orderBook.checkOrderFragment.call(orderID, fragmentId, account.republic);
    // console.log(bool);
    assert(check, "Invalid order fragment");
  },

  OpenOrder: async (account, orderId, fragmentIds, randomMNetwork, leaderNetwork) => {
    await steps.ApproveRen(/* from: */ account, /* to: */ orderBook, MINIMUM_ORDER_FEE);
    await orderBook.openOrder(orderId, fragmentIds, randomMNetwork, leaderNetwork);
  },

};
