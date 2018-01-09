const chai = require("chai");
chai.use(require('chai-as-promised'));
chai.use(require('chai-bignumber')());
chai.should();

const utils = require("../test_utils");
const { accounts } = require("../accounts");
const steps = require("./_steps");

contract('Miner Registar (multiple miners)', function () {

  afterEach("ensure miners are all deregistered", async function () {
    // Reset after each test
    try { await steps.DeregisterAll(accounts); } catch (err) { }
    await steps.WaitForEpoch();
    await steps.WithdrawBondAll(accounts);
  });

  it("can retrieve a list of all miners", async function () {
    await steps.Register(accounts[0], 1000);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([0]);

    await steps.Register(accounts[1], 1000);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([0, 1]);

    await steps.Deregister(accounts[0]);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([1]);

    await steps.Deregister(accounts[1]);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([]);
  })

  it("can manage several miners registering and deregistering", async function () {
    await steps.Register(accounts[0], 1000);
    await steps.Register(accounts[3], 1000);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([0, 3]);

    await steps.Deregister(accounts[3]);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([0]);

    await steps.Register(accounts[1], 1000);
    await steps.Register(accounts[2], 1000);
    await steps.Deregister(accounts[1]);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([0, 2]);

    await steps.Deregister(accounts[2]);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([0]);

    await steps.Deregister(accounts[0]);
    await steps.WaitForEpoch();
    (await steps.GetRegisteredAccountIndexes())
      .should.deep.equal([]);

  })


  // Log costs
  after("log costs", () => {
    utils.printCosts();
  });

});