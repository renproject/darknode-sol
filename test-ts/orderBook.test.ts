
import * as chai from "chai";
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

import * as utils from "./_helpers/test_utils";
import { accounts } from "./_helpers/accounts";
import steps from "./_steps/steps";

const traderCount = 2;
const minerCount = accounts.length - traderCount;

const trader_A = accounts[0];
const trader_B = accounts[1];
const miners = accounts.slice(traderCount, traderCount + minerCount);
let mNetworks: any;

const MINIMUM_ORDER_FEE = 100000;

contract("Order Book", function () {

  before("register traders and miners", async () => {

    // Register traders:
    await steps.RegisterTrader(trader_A, 1000);
    await steps.RegisterTrader(trader_B, 1000);

    // Register miners:
    await steps.RegisterMiners(miners, 1000);

    // Wait for Miner Registrar epoch
    await steps.WaitForEpoch();

    // Get M Networks:
    mNetworks = await steps.GetMNetworks();
  });

  it("can process an order submission", async () => {

    const fragmentCount = (await steps.GetMNetworkSize()).toNumber();

    const { orderID: orderID_A, fragmentIDs: fragmentIDs_A } = steps.GenerateOrder(fragmentCount);
    const { orderID: orderID_B, fragmentIDs: fragmentIDs_B } = steps.GenerateOrder(fragmentCount);

    const outputFragments = steps.CombineFragments(fragmentIDs_A, fragmentIDs_B);

    const mNetwork = steps.RandomMNetwork(mNetworks);
    const leaderNetwork = mNetworks[0];

    await steps.OpenOrder(trader_A, orderID_A, fragmentIDs_A, mNetwork, leaderNetwork);
    await steps.OpenOrder(trader_B, orderID_B, fragmentIDs_B, mNetwork, leaderNetwork);

    await steps.CheckOrderFragments(orderID_A, fragmentIDs_A, mNetwork);
    await steps.CheckOrderFragments(orderID_B, fragmentIDs_B, mNetwork);

    await steps.SubmitOutputFragments(outputFragments, orderID_A, orderID_B, mNetwork, fragmentIDs_A, fragmentIDs_B);

    (await steps.OrdersDidMatch(orderID_A, trader_A, orderID_B, trader_B))
      .should.be.true;

    const kValue = steps.GetKValue(fragmentCount);
    (await steps.WithdrawRewards(mNetwork))
      .should.be.bignumber.equal(Math.floor(2 * MINIMUM_ORDER_FEE / kValue) * kValue);

  });

  // Log costs
  after("log costs", async () => {

    // Register traders:
    await steps.DeregisterTrader(trader_A, 1000);
    await steps.DeregisterTrader(trader_B, 1000);

    // Deregister miners:
    await steps.DeregisterMiners(miners);

    // Wait for Miner Registrar epoch
    await steps.WaitForEpoch();
    await steps.WithdrawDarkNodeBonds(miners);

    utils.printCosts();
  });  

});