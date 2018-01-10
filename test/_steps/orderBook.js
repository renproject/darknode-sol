
const utils = require("../test_utils");
const { accounts, indexMap } = require("../accounts");
var config = require("../../republic-config");

// Initialise:
let orderBook;
(async () => {
  await artifacts.require("RepublicToken").deployed();
  await artifacts.require("MinerRegistrar").deployed();
  await artifacts.require("TraderRegistrar").deployed();
  orderBook = await artifacts.require("OrderBook").deployed();
})();


const steps = {

  SubmitOrder(orderId, fragmentIds, randomMNetwork, leaderNetwork) {
    const miners = [...randomMNetwork, ...leaderNetwork];
    const leaders = [randomMNetwork[0], leaderNetwork[0]];

    orderBook.submitOrder(orderId, fragmentIds, miners, leaders);
  },

};

module.exports = steps;