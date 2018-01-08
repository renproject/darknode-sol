const chai = require("chai");
chai.use(require('chai-as-promised'));
chai.use(require('chai-bignumber')());
chai.should();

const utils = require("../test_utils");
const { accounts } = require("../accounts");

// Specifically request an abstraction for Traders
var Traders = artifacts.require("Traders");


contract('Traders', function (accounts) {


  it("can register and deregister", async function () {
    const instance = await Traders.deployed();

    const bond = parseInt(web3.toWei(0.0001, 'ether'));

    /*** REGISTER ***/ {
      const tx = await u.logTx('Registering', instance.register(publicKey, { value: bond }));

      // Verify event
      const log = tx.logs[0];
      assert(log.event == 'TraderRegistered');
      assert(log.args["traderId"] == republicAddr);
      assert(log.args["bond"].toNumber() == bond);
    }

    /*** DEREGISTER ***/ {
      const tx = await u.logTx('Deregistering', instance.deregister(republicAddr));

      // Verify event
      const log = tx.logs[0];
      assert(log.event == 'TraderDeregistered');
      assert(log.args["traderId"] == republicAddr);
    }
  });


  it("can access a bond from a republic ID", async function () {
    const instance = await Traders.deployed();

    const bond = parseInt(web3.toWei(0.0013, 'ether')); // TODO: Randomise
    await instance.register(publicKey, { value: bond });

    const actualBond = (await instance.getBond(republicAddr)).toNumber();
    assert(actualBond == bond, `bond was ${actualBond} instead of ${bond}`);
    await instance.deregister(republicAddr);
  });


  it("can get their bond refunded", async function () {
    const instance = await Traders.deployed();

    const bond = parseInt(web3.toWei(0.001, 'ether'));
    await instance.register(publicKey, { value: bond });

    let actualBond = (await instance.getBond(republicAddr)).toNumber();
    assert(actualBond > 0, `bond was not positive`);

    const balanceBefore = (await web3.eth.getBalance(addr));
    const tx = (await instance.deregister(republicAddr));

    // Fee
    const fee = await u.transactionFee(tx);

    const balanceNow = (await web3.eth.getBalance(addr));

    // Check that the bond has been returned
    assert(balanceNow.equals(balanceBefore.add(bond).minus(fee)), `comparing: ${balanceNow} to ${balanceBefore.add(bond).minus(fee)}`);

    // Check that bond is now 0
    actualBond = (await instance.getBond(republicAddr)).toNumber();
    assert(actualBond == 0, `bond was ${actualBond} instead of ${0}`);
  });


  it("can't register twice without deregistering", async function () {
    const instance = await Traders.deployed();

    // Register
    const bond = parseInt(web3.toWei(0.001, 'ether'));
    await instance.register(publicKey, { value: bond });

    try {
      // Try to register again
      await instance.register(publicKey, { value: bond });
      assert(false, "Contract did not prevent trader from registering twice");
    } catch (err) {
      assert(true);
    }

    // Deregister
    await instance.deregister(republicAddr);
  });


  it("can increase their bond", async function () {
    const instance = await Traders.deployed();

    // Register
    const bond = parseInt(web3.toWei(0.001, 'ether'));
    await instance.register(publicKey, { value: bond });

    // Increase bond
    const newBond = parseInt(web3.toWei(0.00125, 'ether'));
    const tx = await u.logTx('Increasing bond', instance.increaseBond(republicAddr, { value: newBond - bond }));

    // Check bond
    let actualBond = (await instance.getBond(republicAddr)).toNumber();
    assert(actualBond == newBond, `bond was ${actualBond} instead of ${newBond}`);

    // Verify event
    const log = tx.logs[0];
    assert(log.event == 'TraderBondUpdated', `Unexpected event name`);
    assert(log.args["traderId"] == republicAddr, `Unexpected event details`);
    assert(log.args["newBond"].toNumber() == newBond, `Unexpected event details`);

    await instance.deregister(republicAddr);
  });


  it("can decrease their bond", async function () {
    const instance = await Traders.deployed();

    // Register
    const bondBefore = parseInt(web3.toWei(0.001, 'ether'));
    await instance.register(publicKey, { value: bondBefore });

    // Get balance before
    const balanceBefore = (await web3.eth.getBalance(addr));

    // Increase bond
    const newBond = parseInt(web3.toWei(0.0001, 'ether'));
    const bondDifference = bondBefore - newBond;
    const tx = await u.logTx('Decreasing bond', instance.decreaseBond(republicAddr, newBond));

    // Calculate fee and current balance
    const fee = await u.transactionFee(tx);
    const balanceNow = (await web3.eth.getBalance(addr));

    // Check new bond
    let actualBond = (await instance.getBond(republicAddr)).toNumber();
    assert(actualBond == newBond, `bond was ${actualBond} instead of ${newBond}`);

    // Check that the bond difference has been returned
    assert(balanceNow.equals(balanceBefore.add(bondDifference).minus(fee)), `comparing: ${balanceNow} to ${balanceBefore.add(bondDifference).minus(fee)}`);

    // Verify event
    const log = tx.logs[0];
    assert(log.event == 'TraderBondUpdated', `Unexpected event name`);
    assert(log.args["traderId"] == republicAddr, `Unexpected event details`);
    assert(log.args["newBond"].toNumber() == newBond, `Unexpected event details`);

    await instance.deregister(republicAddr);
  });


  it("can't deregister without first registering", async function () {
    const instance = await Traders.deployed();

    // Deregister a different account
    try {
      await instance.deregister("0x1234");
      assert(false, "Contract did not prevent an unregistered trader from deregistering");
    } catch (err) {
      assert(true);
    }

    // Register and deregister
    await instance.register(publicKey, { value: parseInt(web3.toWei(0.001, 'ether')) });
    await instance.deregister(republicAddr);

    // Deregister again
    try {
      await instance.deregister(republicAddr);
      assert(false, "Contract did not prevent trader from deregistering twice");
    } catch (err) {
      assert(true);
    }
  });

  it("can register again after deregistering", async function () {
    const instance = await Traders.deployed();

    // Register
    const bond = parseInt(web3.toWei(0.001, 'ether'));
    let tx = await u.logTx('Registering again', instance.register(publicKey, { value: bond }));

    // Deregister
    tx = await u.logTx('Deregistering again', instance.deregister(republicAddr));
  });

  it("can retrieve a trader's public key from its address", async function () {
    const instance = await Traders.deployed();

    pubkey = (await instance.getPublicKey(republicAddr));
    assert(pubkey == publicKey, `pubkey was ${pubkey} instead of ${publicKey}`);
  });

});
