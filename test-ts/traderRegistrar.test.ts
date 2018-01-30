
import * as chai from "chai";
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

import * as utils from "./_helpers/test_utils";
import { accounts } from "./_helpers/accounts";
import steps from "./_steps/steps";

// Specifically request an abstraction for Traders

contract("Traders", function () {

  it("can register and deregister", async function () {
    await steps.RegisterTrader(accounts[0], 1000);
    await steps.DeregisterTrader(accounts[0]);
  });

  it("can register again", async function () {
    // Register and deregister, again
    await steps.RegisterTrader(accounts[0], 1100);
    await steps.DeregisterTrader(accounts[0]);
  });

  it("can't deregister without first registering", async function () {
    // Deregistering without first registering should throw an error
    await steps.DeregisterTrader(accounts[0])
      .should.be.rejectedWith(Error);
  });

  it("can access a bond from a republic ID", async function () {
    const bond = 1111;
    await steps.RegisterTrader(accounts[0], bond);

    // Bond should be 1111
    (await steps.GetTraderBond(accounts[0]))
      .should.be.bignumber.equal(bond);

    await steps.DeregisterTrader(accounts[0]);
  });

  it("should not have a bond after deregistering", async function () {
    await steps.RegisterTrader(accounts[0], 1000);
    await steps.DeregisterTrader(accounts[0]);

    // Bond should now be 0
    (await steps.GetTraderBond(accounts[0]))
      .should.be.bignumber.equal(0);
  });

  it("can get their bond refunded", async function () {
    const bond = 1000;
    const balanceBefore = (await steps.GetRenBalance(accounts[0]));
    await steps.RegisterTrader(accounts[0], bond);
    const balanceMiddle = (await steps.GetRenBalance(accounts[0]));
    await steps.DeregisterTrader(accounts[0]);
    const balanceAfter = (await steps.GetRenBalance(accounts[0]));

    // Balances and bond should match up
    balanceAfter
      .should.be.bignumber.equal(balanceBefore);
    balanceAfter
      .should.be.bignumber.equal(balanceMiddle.add(bond));
  });

  it("can't register twice without deregistering", async function () {
    await steps.RegisterTrader(accounts[0], 1000);

    // Registering again should throw an Error
    await steps.RegisterTrader(accounts[0], 1000)
      .should.be.rejectedWith(Error);
    await steps.DeregisterTrader(accounts[0]);
  });

  it("can decrease their bond", async function () {
    const balanceBefore = (await steps.GetRenBalance(accounts[0]));
    await steps.RegisterTrader(accounts[0], 1000);

    // Decrease bond
    const newBond = 100;
    await steps.UpdateTraderBond(accounts[0], newBond);

    // Bond should now be 100
    (await steps.GetTraderBond(accounts[0]))
      .should.be.bignumber.equal(newBond);

    // Bond difference should be returned
    (await steps.GetRenBalance(accounts[0]))
      .should.be.bignumber.equal(balanceBefore.minus(newBond));

    await steps.DeregisterTrader(accounts[0]);
  });

  it("can increase their bond", async function () {
    const balanceBefore = (await steps.GetRenBalance(accounts[0]));
    const oldBond = 1000;
    await steps.RegisterTrader(accounts[0], oldBond);

    // Increase bond
    const newBond = 1500;
    await steps.ApproveRenToTraderRegistrar(accounts[0], newBond - oldBond);
    await steps.UpdateTraderBond(accounts[0], newBond);

    // Bond should now be 1500
    (await steps.GetTraderBond(accounts[0]))
      .should.be.bignumber.equal(newBond);

    // Bond difference should have been withdrawn
    (await steps.GetRenBalance(accounts[0]))
      .should.be.bignumber.equal(balanceBefore.minus(newBond));

    await steps.DeregisterTrader(accounts[0]);
  });

  it("can't increase their bond without first approving ren", async function () {
    const balanceBefore = (await steps.GetRenBalance(accounts[0]));
    const oldBond = 1000;
    await steps.RegisterTrader(accounts[0], oldBond);

    // Increasing bond without approving should throw an error
    const newBond = 1500;
    await steps.ApproveRenToTraderRegistrar(accounts[0], 0);
    await steps.UpdateTraderBond(accounts[0], newBond)
      .should.be.rejectedWith(Error);

    // Bond should still be 1000
    (await steps.GetTraderBond(accounts[0]))
      .should.be.bignumber.equal(oldBond);

    // Bond difference should not have been withdrawn
    const balanceAfter = await steps.GetRenBalance(accounts[0]);
    balanceAfter.should.be.bignumber.equal(balanceBefore.minus(oldBond));

    await steps.DeregisterTrader(accounts[0]);
  });

  it("can't deregister twice for the same registration", async function () {
    await steps.RegisterTrader(accounts[0], 1000);
    await steps.DeregisterTrader(accounts[0]);

    // Deregistering again should throw an error
    await steps.DeregisterTrader(accounts[0])
      .should.be.rejectedWith(Error);
  });

  it("can retrieve a node's public key from its address", async function () {
    (await steps.GetTraderPublicKey(accounts[0].republic))
      .should.equal(accounts[0].public);
  });

  // Log costs
  after("log costs", () => {
    utils.printCosts();
  });

});
