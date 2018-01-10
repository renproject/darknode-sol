
const utils = require("../test_utils");
const { accounts, indexMap } = require("../accounts");
var config = require("../../republic-config");

// Todo: put into config file
const MINIMUM_ORDER_FEE = 100000;

// Initialise:
let orderBook, ren;
(async () => {
  ren = await artifacts.require("RepublicToken").deployed();
  await artifacts.require("MinerRegistrar").deployed();
  await artifacts.require("TraderRegistrar").deployed();
  orderBook = await artifacts.require("OrderBook").deployed();
})();

var steps = require('./steps').steps;

const orderBookSteps = {

  OpenOrder: async (account, orderId, fragmentIds, randomMNetwork, leaderNetwork) => {
    await steps.ApproveRen(/* from: */ account, /* to: */ orderBook, MINIMUM_ORDER_FEE);
    await orderBook.openOrder(orderId, fragmentIds, randomMNetwork, leaderNetwork);
  },

};

module.exports = { orderBookSteps };