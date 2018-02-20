
import * as chai from "chai";
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

import * as utils from "./_helpers/test_utils";
import { accounts } from "./_helpers/accounts";
import steps from "./_steps/steps";

contract("A dark node", function () {

  afterEach("ensure dark node is deregistered", async function () {
    await steps.WaitForEpoch();
    try {
      await steps.WithdrawDarkNodeBond(accounts[0]);
    } catch (err) { /* No amount to refund */ }
  });

  it("can't deregister without first registering", async function () {
    // Deregistering without first registering should throw an error
    await steps.DeregisterDarkNode(accounts[0])
      .should.be.rejectedWith(Error);

  });

  it("can register and deregister", async function () {
    // Register and deregister
    await steps.RegisterDarkNode(accounts[0], 1000);
    await steps.WaitForEpoch();
    await steps.DeregisterDarkNode(accounts[0]);
  });

  it("can register again after deregistering", async function () {
    // Register and deregister, again
    await steps.RegisterDarkNode(accounts[0], 1100);
    await steps.WaitForEpoch();
    await steps.DeregisterDarkNode(accounts[0]);
  });

  it("can access a bond of a republic ID", async function () {
    const bond = 1111;
    await steps.RegisterDarkNode(accounts[0], bond);
    await steps.WaitForEpoch();

    // Bond should be 1111
    (await steps.GetDarkNodeBond(accounts[0]))
      .should.be.bignumber.equal(bond);

    await steps.DeregisterDarkNode(accounts[0]);
  });

  it("should only refund bond after epoch", async function () {
    await steps.RegisterDarkNode(accounts[0], 1000);
    await steps.WaitForEpoch();
    await steps.DeregisterDarkNode(accounts[0]);
    await steps.WithdrawDarkNodeBond(accounts[0])
      .should.be.rejectedWith(Error);
    (await steps.GetDarkNodeBond(accounts[0]))
      .should.be.bignumber.equal(1000);
    await steps.WaitForEpoch();
    await steps.WithdrawDarkNodeBond(accounts[0]);

    // Bond should now be 0
    (await steps.GetDarkNodeBond(accounts[0]))
      .should.be.bignumber.equal(0);
  });

  it("can get their bond refunded", async function () {
    const bond = 1000;
    const balanceBefore = (await steps.GetRenBalance(accounts[0]));
    await steps.RegisterDarkNode(accounts[0], bond);
    const balanceMiddle = (await steps.GetRenBalance(accounts[0]));
    await steps.DeregisterDarkNode(accounts[0]);
    await steps.WaitForEpoch();
    await steps.WithdrawDarkNodeBond(accounts[0]);
    const balanceAfter = (await steps.GetRenBalance(accounts[0]));

    // Balances and bond should match up
    balanceAfter
      .should.be.bignumber.equal(balanceBefore);
    balanceAfter
      .should.be.bignumber.equal(balanceMiddle.add(bond));
  });

  it("can't register twice before an epoch without deregistering", async function () {
    await steps.RegisterDarkNode(accounts[0], 1000);

    // Registering again should throw an Error
    await steps.RegisterDarkNode(accounts[0], 1000)
      .should.be.rejectedWith(Error);
    await steps.DeregisterDarkNode(accounts[0]);
  });

  it("can register twice before an epoch after deregistering", async function () {
    await steps.RegisterDarkNode(accounts[0], 1000);
    await steps.DeregisterDarkNode(accounts[0], 1000);
    await steps.RegisterDarkNode(accounts[0], 1000);
    await steps.DeregisterDarkNode(accounts[0]);
  });

  it("can't register twice without deregistering", async function () {
    await steps.RegisterDarkNode(accounts[0], 1000);
    await steps.WaitForEpoch();

    // Registering again should throw an Error
    await steps.RegisterDarkNode(accounts[0], 1000)
      .should.be.rejectedWith(Error);
    await steps.DeregisterDarkNode(accounts[0]);
  });

  it("can decrease their bond", async function () {
    const balanceBefore = (await steps.GetRenBalance(accounts[0]));
    await steps.RegisterDarkNode(accounts[0], 1000);

    // Decrease bond
    const newBond = 100;
    await steps.UpdateDarkNodeBond(accounts[0], newBond);
    await steps.WaitForEpoch();

    // Bond should now be 100
    (await steps.GetDarkNodeBond(accounts[0]))
      .should.be.bignumber.equal(newBond);

    await steps.WithdrawDarkNodeBond(accounts[0]);

    // Bond difference should be returned
    (await steps.GetRenBalance(accounts[0]))
      .should.be.bignumber.equal(balanceBefore.minus(newBond));

    await steps.DeregisterDarkNode(accounts[0]);
  });

  it("can increase their bond", async function () {
    const balanceBefore = (await steps.GetRenBalance(accounts[0]));
    const oldBond = 1000;
    await steps.RegisterDarkNode(accounts[0], oldBond);

    // Increase bond
    const newBond = 1500;
    await steps.ApproveRenToDarkNodeRegistrar(accounts[0], newBond - oldBond);
    await steps.UpdateDarkNodeBond(accounts[0], newBond);

    // Bond should now be 1500
    (await steps.GetDarkNodeBond(accounts[0]))
      .should.be.bignumber.equal(newBond);

    // Bond difference should have been withdrawn
    (await steps.GetRenBalance(accounts[0]))
      .should.be.bignumber.equal(balanceBefore.minus(newBond));

    await steps.DeregisterDarkNode(accounts[0]);
  });

  it("updating their bond to their previous bond has no effect", async function () {
    const balanceBefore = (await steps.GetRenBalance(accounts[0]));
    const oldBond = 1000;
    await steps.RegisterDarkNode(accounts[0], oldBond);
    await steps.UpdateDarkNodeBond(accounts[0], oldBond);

    // Bond should now be 1000
    (await steps.GetDarkNodeBond(accounts[0]))
      .should.be.bignumber.equal(oldBond);

    // Bond difference should have been withdrawn
    (await steps.GetRenBalance(accounts[0]))
      .should.be.bignumber.equal(balanceBefore.minus(oldBond));

    await steps.DeregisterDarkNode(accounts[0]);
  });

  it("can't increase their bond without first approving ren", async function () {
    const balanceBefore = (await steps.GetRenBalance(accounts[0]));
    const oldBond = 1000;
    await steps.RegisterDarkNode(accounts[0], oldBond);

    // Increasing bond without approving should throw an error
    const newBond = 1500;
    await steps.ApproveRenToDarkNodeRegistrar(accounts[0], 0);
    await steps.UpdateDarkNodeBond(accounts[0], newBond)
      .should.be.rejectedWith(Error);

    // Bond should still be 1000
    (await steps.GetDarkNodeBond(accounts[0]))
      .should.be.bignumber.equal(oldBond);

    // Bond difference should not have been withdrawn
    const balanceAfter = await steps.GetRenBalance(accounts[0]);
    balanceAfter.should.be.bignumber.equal(balanceBefore.minus(oldBond));

    await steps.DeregisterDarkNode(accounts[0]);
  });

  it("can't deregister twice for the same registration", async function () {
    await steps.RegisterDarkNode(accounts[0], 1000);
    await steps.DeregisterDarkNode(accounts[0]);

    // Deregistering again should throw an error
    await steps.DeregisterDarkNode(accounts[0])
      .should.be.rejectedWith(Error);
  });

  it("can retrieve a dark node's public key from its address", async function () {
    (await steps.GetDarkNodePublicKey(accounts[0]))
      .should.equal(accounts[0].public);
  });

  it("can retrieve a dark node's republic ID from its ethereum address", async function () {
    (await steps.GetDarkNodeID(accounts[0]))
      .should.equal(accounts[0].republic);
  });

  // Log costs
  after("log costs", () => {
    utils.printCosts();
  });

});