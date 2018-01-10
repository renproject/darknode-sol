const chai = require("chai");
chai.use(require('chai-as-promised'));
chai.use(require('chai-bignumber')());
chai.should();

const utils = require("../test_utils");
const { accounts } = require("../accounts");
const steps = require("../_steps/steps");

contract('A miner', function () {

  afterEach("ensure miner is deregistered", async function () {
    // After each test, make sure that the miner is not registered
    try { await steps.DeregisterMiner(accounts[0]); } catch (err) { }
    await steps.WaitForEpoch();
    await steps.WithdrawMinerBond(accounts[0]);
  });

  it("can't deregister without first registering", async function () {
    // Deregistering without first registering should throw an error
    await steps.DeregisterMiner(accounts[0])
      .should.be.rejectedWith(Error);
  });

  it("can register and deregister", async function () {
    // Register and deregister
    await steps.RegisterMiner(accounts[0], 1000);
    await steps.WaitForEpoch();
    await steps.DeregisterMiner(accounts[0]);
  });

  it("can register again after deregistering", async function () {
    // Register and deregister, again
    await steps.RegisterMiner(accounts[0], 1100);
    await steps.WaitForEpoch();
    await steps.DeregisterMiner(accounts[0]);
  });

  it("can access a bond of a republic ID", async function () {
    const bond = 1111;
    await steps.RegisterMiner(accounts[0], bond);
    await steps.WaitForEpoch();

    // Bond should be 1111
    (await steps.GetMinerBond(accounts[0]))
      .should.be.bignumber.equal(bond);

    await steps.DeregisterMiner(accounts[0]);
  });

  it("should only refund bond after epoch", async function () {
    await steps.RegisterMiner(accounts[0], 1000);
    await steps.WaitForEpoch();
    await steps.DeregisterMiner(accounts[0]);
    await steps.WithdrawMinerBond(accounts[0]);
    (await steps.GetMinerBond(accounts[0]))
      .should.be.bignumber.equal(1000);
    await steps.WaitForEpoch();
    await steps.WithdrawMinerBond(accounts[0]);

    // Bond should now be 0
    (await steps.GetMinerBond(accounts[0]))
      .should.be.bignumber.equal(0);
  });

  it("can get their bond refunded", async function () {
    const bond = 1000;
    const balanceBefore = (await steps.GetRenBalance(accounts[0]));
    await steps.RegisterMiner(accounts[0], bond);
    const balanceMiddle = (await steps.GetRenBalance(accounts[0]));
    await steps.DeregisterMiner(accounts[0]);
    await steps.WaitForEpoch();
    await steps.WithdrawMinerBond(accounts[0]);
    const balanceAfter = (await steps.GetRenBalance(accounts[0]));

    // Balances and bond should match up
    balanceAfter
      .should.be.bignumber.equal(balanceBefore);
    balanceAfter
      .should.be.bignumber.equal(balanceMiddle.add(bond));
  });

  it("can't register twice before an epoch without deregistering", async function () {
    await steps.RegisterMiner(accounts[0], 1000);

    // Registering again should throw an Error
    await steps.RegisterMiner(accounts[0], 1000)
      .should.be.rejectedWith(Error);
    await steps.DeregisterMiner(accounts[0]);
  });

  it("can register twice before an epoch after deregistering", async function () {
    await steps.RegisterMiner(accounts[0], 1000);
    await steps.DeregisterMiner(accounts[0], 1000);
    await steps.RegisterMiner(accounts[0], 1000);
    await steps.DeregisterMiner(accounts[0]);
  });

  it("can't register twice without deregistering", async function () {
    await steps.RegisterMiner(accounts[0], 1000);
    await steps.WaitForEpoch();

    // Registering again should throw an Error
    await steps.RegisterMiner(accounts[0], 1000)
      .should.be.rejectedWith(Error);
    await steps.DeregisterMiner(accounts[0]);
  });

  it("can decrease their bond", async function () {
    const balanceBefore = (await steps.GetRenBalance(accounts[0]));
    await steps.RegisterMiner(accounts[0], 1000);

    // Decrease bond
    const newBond = 100;
    await steps.UpdateMinerBond(accounts[0], newBond);
    await steps.WaitForEpoch();

    // Bond should now be 100
    (await steps.GetMinerBond(accounts[0]))
      .should.be.bignumber.equal(newBond);

    await steps.WithdrawMinerBond(accounts[0]);

    // Bond difference should be returned
    (await steps.GetRenBalance(accounts[0]))
      .should.be.bignumber.equal(balanceBefore.minus(newBond));

    await steps.DeregisterMiner(accounts[0]);
  });

  it("can increase their bond", async function () {
    const balanceBefore = (await steps.GetRenBalance(accounts[0]));
    const oldBond = 1000;
    await steps.RegisterMiner(accounts[0], oldBond);

    // Increase bond
    const newBond = 1500;
    await steps.ApproveRenToMinerRegistrar(newBond - oldBond, accounts[0])
    await steps.UpdateMinerBond(accounts[0], newBond);

    // Bond should now be 1500
    (await steps.GetMinerBond(accounts[0]))
      .should.be.bignumber.equal(newBond);

    // Bond difference should have been withdrawn
    (await steps.GetRenBalance(accounts[0]))
      .should.be.bignumber.equal(balanceBefore.minus(newBond));

    await steps.DeregisterMiner(accounts[0]);
  });

  it("can't increase their bond without first approving ren", async function () {
    const balanceBefore = (await steps.GetRenBalance(accounts[0]));
    const oldBond = 1000;
    await steps.RegisterMiner(accounts[0], oldBond);

    // Increasing bond without approving should throw an error
    const newBond = 1500;
    await steps.ApproveRenToMinerRegistrar(0, accounts[0]);
    await steps.UpdateMinerBond(accounts[0], newBond)
      .should.be.rejectedWith(Error);

    // Bond should still be 1000
    (await steps.GetMinerBond(accounts[0]))
      .should.be.bignumber.equal(oldBond);

    // Bond difference should not have been withdrawn
    const balanceAfter = await steps.GetRenBalance(accounts[0]);
    balanceAfter.should.be.bignumber.equal(balanceBefore.minus(oldBond));

    await steps.DeregisterMiner(accounts[0]);
  });

  it("can't deregister twice for the same registration", async function () {
    await steps.RegisterMiner(accounts[0], 1000);
    await steps.DeregisterMiner(accounts[0]);

    // Deregistering again should throw an error
    await steps.DeregisterMiner(accounts[0])
      .should.be.rejectedWith(Error);
  });

  it("can retrieve a miner's public key from its address", async function () {
    (await steps.GetMinerPublicKey(accounts[0].republic))
      .should.equal(accounts[0].public);
  });

  // Log costs
  after("log costs", () => {
    utils.printCosts();
  });

});