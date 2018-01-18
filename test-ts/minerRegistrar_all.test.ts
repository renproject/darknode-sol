import { contract } from "../truffle";

import * as chai from "chai";
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

import * as utils from "./_helpers/test_utils";
import { accounts } from "./_helpers/accounts";
import steps from "./_steps/steps";

/**
 * 
 * CONFIGURE NUMBER OF MINERS IN republic-config.js
 * 
 * 
 */

contract("Miner Registar (all miners)", function () {

  afterEach("ensure miners are all deregistered", async function () {
    // Reset after each test
    await steps.WaitForEpoch();
    // await steps.WithdrawMinerBonds(accounts);
  });

  it("can register miners", async function () {
    await steps.RegisterMiners(accounts, 1000);

    // Wait for next shuffling
    await steps.WaitForEpoch();

    await steps.DeregisterMiners(accounts);
  });

  it("can get M network", async () => {

    await steps.RegisterMiners(accounts, 1000);
    await steps.WaitForEpoch();

    // Get M Networks:
    const mNetworks = await steps.GetMNetworks();

    (await steps.GetMNetworkSize())
      .should.be.bignumber.equal(mNetworks[0].length);

    await steps.DeregisterMiners(accounts);
    await steps.WaitForEpoch();
    await steps.WithdrawMinerBonds(accounts);
  });

  // Log costs
  after("log costs", () => {
    utils.printCosts();
  });

});