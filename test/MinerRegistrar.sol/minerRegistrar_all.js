const chai = require("chai");
chai.use(require('chai-as-promised'));
chai.use(require('chai-bignumber')());
chai.should();

const utils = require("../test_utils");
const { accounts } = require("../accounts");
const steps = require("../_steps/steps");



/**
 * 
 * CONFIGURE NUMBER OF MINERS IN republic-config.js
 * 
 * 
 */

contract('Miner Registar (all miners)', function () {

  afterEach("ensure miners are all deregistered", async function () {
    // Reset after each test
    try { await steps.DeregisterAllMiners(accounts); } catch (err) { }
    await steps.WaitForEpoch();
    await steps.WithdrawAllMinerBonds(accounts);
  });



  it("can register miners", async function () {
    await steps.RegisterAllMiners(accounts, 1000);

    // Wait for next shuffling
    await steps.WaitForEpoch();

    await steps.DeregisterAllMiners(accounts);
  });




  // Log costs
  after("log costs", () => {
    utils.printCosts();
  });

});