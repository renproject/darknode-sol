const chai = require("chai");
chai.use(require('chai-as-promised'));
chai.use(require('chai-bignumber')());
chai.should();

const utils = require("../test_utils");
const { accounts } = require("../accounts");
const steps = require('./steps');

// Specifically request an abstraction for Traders

(async () => {
  ren = await artifacts.require("RepublicToken").deployed();
  traderRegistrar = await artifacts.require("TraderRegistrar").deployed();
})();


contract('Traders', function () {


  it("can register and deregister", async function () {
    await steps.Register(accounts[0], 1000);
    await steps.Deregister(accounts[0]);

  });


  // it("can access a bond from a republic ID", async function () {
  //   const traderRegistrar = await Traders.deployed();

  //   const bond = parseInt(web3.toWei(0.0013, 'ether')); // TODO: Randomise
  //   await traderRegistrar.register(accounts[0].public, { value: bond });

  //   const actualBond = (await traderRegistrar.getBond(accounts[0].republic)).toNumber();
  //   assert(actualBond == bond, `bond was ${actualBond} instead of ${bond}`);
  //   await traderRegistrar.deregister(accounts[0].republic);
  // });


  // it("can get their bond refunded", async function () {
  //   const traderRegistrar = await Traders.deployed();

  //   const bond = parseInt(web3.toWei(0.001, 'ether'));
  //   await traderRegistrar.register(accounts[0].public, { value: bond });

  //   let actualBond = (await traderRegistrar.getBond(accounts[0].republic)).toNumber();
  //   assert(actualBond > 0, `bond was not positive`);

  //   const balanceBefore = (await web3.eth.getBalance(addr));
  //   const tx = (await traderRegistrar.deregister(accounts[0].republic));

  //   // Fee
  //   const fee = await utils.transactionFee(tx);

  //   const balanceNow = (await web3.eth.getBalance(addr));

  //   // Check that the bond has been returned
  //   assert(balanceNow.equals(balanceBefore.add(bond).minus(fee)), `comparing: ${balanceNow} to ${balanceBefore.add(bond).minus(fee)}`);

  //   // Check that bond is now 0
  //   actualBond = (await traderRegistrar.getBond(accounts[0].republic)).toNumber();
  //   assert(actualBond == 0, `bond was ${actualBond} instead of ${0}`);
  // });


  // it("can't register twice without deregistering", async function () {
  //   const traderRegistrar = await Traders.deployed();

  //   // Register
  //   const bond = parseInt(web3.toWei(0.001, 'ether'));
  //   await traderRegistrar.register(accounts[0].public, { value: bond });

  //   try {
  //     // Try to register again
  //     await traderRegistrar.register(accounts[0].public, { value: bond });
  //     assert(false, "Contract did not prevent trader from registering twice");
  //   } catch (err) {
  //     assert(true);
  //   }

  //   // Deregister
  //   await traderRegistrar.deregister(accounts[0].republic);
  // });


  // it("can increase their bond", async function () {
  //   const traderRegistrar = await Traders.deployed();

  //   // Register
  //   const bond = parseInt(web3.toWei(0.001, 'ether'));
  //   await traderRegistrar.register(accounts[0].public, { value: bond });

  //   // Increase bond
  //   const newBond = parseInt(web3.toWei(0.00125, 'ether'));
  //   const tx = await utils.logTx('Increasing bond', traderRegistrar.increaseBond(accounts[0].republic, { value: newBond - bond }));

  //   // Check bond
  //   let actualBond = (await traderRegistrar.getBond(accounts[0].republic)).toNumber();
  //   assert(actualBond == newBond, `bond was ${actualBond} instead of ${newBond}`);

  //   // Verify event
  //   const log = tx.logs[0];
  //   assert(log.event == 'TraderBondUpdated', `Unexpected event name`);
  //   assert(log.args["traderId"] == accounts[0].republic, `Unexpected event details`);
  //   assert(log.args["newBond"].toNumber() == newBond, `Unexpected event details`);

  //   await traderRegistrar.deregister(accounts[0].republic);
  // });


  // it("can decrease their bond", async function () {
  //   const traderRegistrar = await Traders.deployed();

  //   // Register
  //   const bondBefore = parseInt(web3.toWei(0.001, 'ether'));
  //   await traderRegistrar.register(accounts[0].public, { value: bondBefore });

  //   // Get balance before
  //   const balanceBefore = (await web3.eth.getBalance(addr));

  //   // Increase bond
  //   const newBond = parseInt(web3.toWei(0.0001, 'ether'));
  //   const bondDifference = bondBefore - newBond;
  //   const tx = await utils.logTx('Decreasing bond', traderRegistrar.decreaseBond(accounts[0].republic, newBond));

  //   // Calculate fee and current balance
  //   const fee = await utils.transactionFee(tx);
  //   const balanceNow = (await web3.eth.getBalance(addr));

  //   // Check new bond
  //   let actualBond = (await traderRegistrar.getBond(accounts[0].republic)).toNumber();
  //   assert(actualBond == newBond, `bond was ${actualBond} instead of ${newBond}`);

  //   // Check that the bond difference has been returned
  //   assert(balanceNow.equals(balanceBefore.add(bondDifference).minus(fee)), `comparing: ${balanceNow} to ${balanceBefore.add(bondDifference).minus(fee)}`);

  //   // Verify event
  //   const log = tx.logs[0];
  //   assert(log.event == 'TraderBondUpdated', `Unexpected event name`);
  //   assert(log.args["traderId"] == accounts[0].republic, `Unexpected event details`);
  //   assert(log.args["newBond"].toNumber() == newBond, `Unexpected event details`);

  //   await traderRegistrar.deregister(accounts[0].republic);
  // });


  // it("can't deregister without first registering", async function () {
  //   const traderRegistrar = await Traders.deployed();

  //   // Deregister a different account
  //   try {
  //     await traderRegistrar.deregister("0x1234");
  //     assert(false, "Contract did not prevent an unregistered trader from deregistering");
  //   } catch (err) {
  //     assert(true);
  //   }

  //   // Register and deregister
  //   await traderRegistrar.register(accounts[0].public, { value: parseInt(web3.toWei(0.001, 'ether')) });
  //   await traderRegistrar.deregister(accounts[0].republic);

  //   // Deregister again
  //   try {
  //     await traderRegistrar.deregister(accounts[0].republic);
  //     assert(false, "Contract did not prevent trader from deregistering twice");
  //   } catch (err) {
  //     assert(true);
  //   }
  // });

  // it("can register again after deregistering", async function () {
  //   const traderRegistrar = await Traders.deployed();

  //   // Register
  //   const bond = parseInt(web3.toWei(0.001, 'ether'));
  //   let tx = await utils.logTx('Registering again', traderRegistrar.register(accounts[0].public, { value: bond }));

  //   // Deregister
  //   tx = await utils.logTx('Deregistering again', traderRegistrar.deregister(accounts[0].republic));
  // });

  // it("can retrieve a trader's public key from its address", async function () {
  //   const traderRegistrar = await Traders.deployed();

  //   pubkey = (await traderRegistrar.getPublicKey(accounts[0].republic));
  //   assert(pubkey == accounts[0].public, `pubkey was ${pubkey} instead of ${accounts[0].public}`);
  // });

});
