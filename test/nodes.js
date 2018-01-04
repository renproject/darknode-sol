const chai = require("chai");
chai.use(require('chai-as-promised'));
chai.use(require('chai-bignumber')());
chai.should();

const utils = require("./test_utils");
const accounts = require("./testrpc_accounts");
const steps = require("./steps");

contract('Nodes', function () {

  // afterEach("ensure node is deregistered", async function () {
  //   // After each test, make sure that the node is not registered
  //   try { await steps.Deregister(accounts[0]); } catch (err) { }
  // });

  // it("can't deregister without first registering", async function () {
  //   // Deregistering without first registering should throw an error
  //   await steps.Deregister(accounts[0])
  //     .should.be.rejectedWith(Error);
  // });

  // it("can register and deregister", async function () {
  //   // Register and deregister
  //   await steps.Register(accounts[0], 1000);
  //   await steps.Deregister(accounts[0]);
  // });

  // it("can register again after deregistering", async function () {
  //   // Register and deregister, again
  //   await steps.Register(accounts[0], 1100);
  //   await steps.Deregister(accounts[0]);
  // });

  // it("can access a bond of a republic ID", async function () {
  //   const bond = 1111;
  //   await steps.Register(accounts[0], bond);

  //   // Bond should be 1111
  //   (await steps.GetBond(accounts[0]))
  //     .should.be.bignumber.equal(bond);

  //   await steps.Deregister(accounts[0]);
  // });

  // it("should not have a bond after deregistering", async function () {
  //   await steps.Register(accounts[0], 1000);
  //   await steps.Deregister(accounts[0]);

  //   // Bond should now be 0
  //   (await steps.GetBond(accounts[0]))
  //     .should.be.bignumber.equal(0);
  // });

  // it("can get their bond refunded", async function () {
  //   const bond = 1000;
  //   const balanceBefore = (await steps.GetRenBalance(accounts[0]));
  //   await steps.Register(accounts[0], bond);
  //   const balanceMiddle = (await steps.GetRenBalance(accounts[0]));
  //   await steps.Deregister(accounts[0]);
  //   const balanceAfter = (await steps.GetRenBalance(accounts[0]));

  //   // Balances and bond should match up
  //   balanceAfter
  //     .should.be.bignumber.equal(balanceBefore);
  //   balanceAfter
  //     .should.be.bignumber.equal(balanceMiddle.add(bond));
  // });

  // it("can't register twice without deregistering", async function () {
  //   await steps.Register(accounts[0], 1000);

  //   // Registering again should throw an Error
  //   await steps.Register(accounts[0], 1000)
  //     .should.be.rejectedWith(Error);
  //   await steps.Deregister(accounts[0]);
  // });

  // it("can decrease their bond", async function () {
  //   const balanceBefore = (await steps.GetRenBalance(accounts[0]));
  //   await steps.Register(accounts[0], 1000);

  //   // Decrease bond
  //   const newBond = 100;
  //   await steps.UpdateBond(accounts[0], newBond);

  //   // Bond should now be 100
  //   (await steps.GetBond(accounts[0]))
  //     .should.be.bignumber.equal(newBond);

  //   // Bond difference should be returned
  //   (await steps.GetRenBalance(accounts[0]))
  //     .should.be.bignumber.equal(balanceBefore.minus(newBond));

  //   await steps.Deregister(accounts[0]);
  // });

  // it("can increase their bond", async function () {
  //   const balanceBefore = (await steps.GetRenBalance(accounts[0]));
  //   const oldBond = 1000;
  //   await steps.Register(accounts[0], oldBond);

  //   // Increase bond
  //   const newBond = 1500;
  //   await steps.ApproveRen(newBond - oldBond, accounts[0])
  //   await steps.UpdateBond(accounts[0], newBond);

  //   // Bond should now be 1500
  //   (await steps.GetBond(accounts[0]))
  //     .should.be.bignumber.equal(newBond);

  //   // Bond difference should have been withdrawn
  //   (await steps.GetRenBalance(accounts[0]))
  //     .should.be.bignumber.equal(balanceBefore.minus(newBond));

  //   await steps.Deregister(accounts[0]);
  // });

  // it("can't increase their bond without first approving ren", async function () {
  //   const balanceBefore = (await steps.GetRenBalance(accounts[0]));
  //   const oldBond = 1000;
  //   await steps.Register(accounts[0], oldBond);

  //   // Increasing bond without approving should throw an error
  //   const newBond = 1500;
  //   await steps.ApproveRen(0, accounts[0]);
  //   await steps.UpdateBond(accounts[0], newBond)
  //     .should.be.rejectedWith(Error);

  //   // Bond should still be 1000
  //   (await steps.GetBond(accounts[0]))
  //     .should.be.bignumber.equal(oldBond);

  //   // Bond difference should not have been withdrawn
  //   const balanceAfter = await steps.GetRenBalance(accounts[0]);
  //   balanceAfter.should.be.bignumber.equal(balanceBefore.minus(oldBond));

  //   await steps.Deregister(accounts[0]);
  // });

  // it("can't deregister twice for the same registration", async function () {
  //   await steps.Register(accounts[0], 1000);
  //   await steps.Deregister(accounts[0]);

  //   // Deregistering again should throw an error
  //   await steps.Deregister(accounts[0])
  //     .should.be.rejectedWith(Error);
  // });

  // it("can retrieve a node's public key from its address", async function () {
  //   (await steps.GetPublicKey(accounts[0].republic))
  //     .should.equal(accounts[0].public);
  // });

  // it("can retrieve a list of all nodes", async function () {
  //   await steps.Register(accounts[0], 1000);
  //   await steps.WaitForEpoch();
  //   console.log(await steps.GetRegisteredNodes());

  //   await steps.Register(accounts[1], 1000);
  //   await steps.WaitForEpoch();
  //   console.log(await steps.GetRegisteredNodes());

  //   await steps.Deregister(accounts[0]);
  //   await steps.WaitForEpoch();
  //   console.log(await steps.GetRegisteredNodes());

  //   await steps.Deregister(accounts[1]);
  //   await steps.WaitForEpoch();
  //   console.log(await steps.GetRegisteredNodes());
  // })

  it("can deregister a miner with a pending registration", async function () {
    await steps.Register(accounts[0], 1000);
    await steps.Register(accounts[3], 1000);
    await steps.WaitForEpoch();
    await steps.Deregister(accounts[3]);
    await steps.WaitForEpoch();
    console.log("[_||0|]");
    console.log(await steps.GetAllNodes());

    await steps.Register(accounts[1], 1000);
    console.log("[_||0|1]");
    console.log(await steps.GetAllNodes());
    await steps.Register(accounts[2], 1000);
    console.log("[_||0|12]");
    console.log(await steps.GetAllNodes());

    await steps.Deregister(accounts[1]);
    await steps.WaitForEpoch();
    console.log("[_||02|]");
    console.log(await steps.GetAllNodes());

    await steps.Deregister(accounts[2]);
    console.log("[_|2|0|]");
    console.log(await steps.GetAllNodes());
    await steps.WaitForEpoch();
    console.log("[__||0|]");
    console.log(await steps.GetAllNodes());
    await steps.Deregister(accounts[0]);
    await steps.WaitForEpoch();
    console.log("[___|||]");
    console.log(await steps.GetAllNodes());
  })

  // /*** Pool shuffling ***/
  // it("can register and deregister", async function () {
  //   const pools = [];
  //   await steps.Register(accounts[0], 1000, 1 * utils.seconds);
  //   await steps.Deregister(accounts[0]);
  // });




  // Log costs
  after("log costs", () => {
    utils.printCosts();
  });

});