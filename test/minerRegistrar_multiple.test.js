const chai = require("chai");
chai.use(require('chai-as-promised'));
chai.use(require('chai-bignumber')());
chai.should();

const utils = require("./_helpers/test_utils");
const { accounts } = require("./_helpers/accounts");
const steps = require("./_steps/steps").steps;

contract('Miner Registar (multiple miners)', function () {

  afterEach("ensure miners are all deregistered", async function () {
    // Reset after each test
    await steps.WaitForEpoch();
  });

  it("can retrieve a list of all miners", async function () {
    await steps.RegisterMiner(accounts[0], 1000);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([0]);

    await steps.RegisterMiner(accounts[1], 1000);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([0, 1]);

    await steps.DeregisterMiner(accounts[0]);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([1]);

    await steps.DeregisterMiner(accounts[1]);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([]);

    await steps.WithdrawAllMinerBonds(accounts.slice(0, 2));
  })

  it("can manage several miners registering and deregistering", async function () {
    await steps.RegisterMiner(accounts[0], 1000);
    await steps.RegisterMiner(accounts[3], 1000);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([0, 3]);

    await steps.DeregisterMiner(accounts[3]);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([0]);

    await steps.RegisterMiner(accounts[1], 1000);
    await steps.RegisterMiner(accounts[2], 1000);
    await steps.DeregisterMiner(accounts[1]);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([0, 2]);

    await steps.DeregisterMiner(accounts[2]);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([0]);

    await steps.DeregisterMiner(accounts[0]);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([]);

    await steps.WithdrawAllMinerBonds(accounts.slice(0, 4));
  })


  // Log costs
  after("log costs", () => {
    utils.printCosts();
  });

});