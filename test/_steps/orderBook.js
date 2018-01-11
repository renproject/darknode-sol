
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
    const check = await orderBook.checkOrderFragment.call(orderID, fragmentId, miner.republic);
    assert(check, "Invalid order fragment");
  },

  SubmitOrderFragment: async (outputFragment, zkCommitment, orderID1, orderID2, miner, fragmentID1, fragmentID2) => {
    // (bytes _outputFragment, bytes32 _zkCommitment, bytes32 _orderID1, bytes32 _orderID2, bytes20 _minerID, bytes32 _orderFragmentID1, bytes32 _orderFragmentID2)
    await orderBook.submitOutputFragment(outputFragment, zkCommitment, orderID1, orderID2, miner.republic, fragmentID1, fragmentID2, { from: miner.address });
  },

  OpenOrder: async (trader, orderId, fragmentIds, randomMNetwork, leaderNetwork) => {
    await steps.ApproveRen(/* from: */ trader, /* to: */ orderBook, MINIMUM_ORDER_FEE);
    const randomMNetworkIDs = randomMNetwork.map(account => account.republic);
    const leaderNetworkIDs = leaderNetwork.map(account => account.republic);
    await orderBook.openOrder(orderId, fragmentIds, randomMNetworkIDs, leaderNetworkIDs, { from: trader.address });
  },

};
