const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.should();

const MINIMUM_BOND = 100;
const MINIMUM_POD_SIZE = 72;
const MINIMUM_EPOCH_INTERVAL = 2;

// Makes an ID for a darknode
function ID(i) {
  return web3.utils.sha3(i).slice(0, 42);
}

// Makes a public key for a darknode
function PUBK(i) {
  return web3.utils.sha3(i);
}


contract("DarknodeRegistry", function (accounts) {

  let dnr, ren;

  before(async function () {
    ren = await RepublicToken.new();
    dnr = await DarknodeRegistry.new(
      ren.address,
      MINIMUM_BOND,
      MINIMUM_POD_SIZE,
      MINIMUM_EPOCH_INTERVAL
    );
    for (i = 1; i < accounts.length; i++) {
      await ren.transfer(accounts[i], MINIMUM_BOND);
    }
  });

  it("can update minimum bond", async () => {
    await dnr.updateMinimumBond(0x1);
    await waitForEpoch(dnr);
    (await dnr.minimumBond()).should.equal("1");
    await dnr.updateMinimumBond(MINIMUM_BOND, { from: accounts[1] })
      .should.be.rejected;
    await dnr.updateMinimumBond(MINIMUM_BOND);
    (await dnr.minimumBond()).should.equal("1");
    await waitForEpoch(dnr);
    (await dnr.minimumBond()).should.equal(MINIMUM_BOND.toString());
  });

  it("can update minimum pod size", async () => {
    await dnr.updateMinimumPodSize(0x0);
    await waitForEpoch(dnr);
    (await dnr.minimumPodSize()).should.equal("0");
    await dnr.updateMinimumPodSize(MINIMUM_POD_SIZE, { from: accounts[1] })
      .should.be.rejected;
    await dnr.updateMinimumPodSize(MINIMUM_POD_SIZE);
    (await dnr.minimumPodSize()).should.equal("0");
    await waitForEpoch(dnr);
    (await dnr.minimumPodSize()).should.equal(MINIMUM_POD_SIZE.toString());
  });

  it("can update minimum epoch interval", async () => {
    await dnr.updateMinimumEpochInterval(0x0);
    await waitForEpoch(dnr);
    (await dnr.minimumEpochInterval()).should.equal("0");
    await dnr.updateMinimumEpochInterval(MINIMUM_EPOCH_INTERVAL, { from: accounts[1] })
      .should.be.rejected;
    await dnr.updateMinimumEpochInterval(MINIMUM_EPOCH_INTERVAL);
    (await dnr.minimumEpochInterval()).should.equal("0");
    await waitForEpoch(dnr);
    (await dnr.minimumEpochInterval()).should.equal(MINIMUM_EPOCH_INTERVAL.toString());
  });

  it("can not register a Dark Node with a bond less than the minimum bond", async () => {
    const lowBond = MINIMUM_BOND - 1;
    await ren.approve(dnr.address, lowBond, { from: accounts[0] });
    await dnr.register(ID("A"), PUBK("A"), lowBond).should.be.rejected;
    await dnr.register(ID("A"), PUBK("A"), MINIMUM_BOND).should.be.rejected;
  })

  it("can not call epoch before the minimum time interval", async () => {
    await dnr.epoch();
    await dnr.epoch().should.be.rejected;
  })

  it("can register multiple Dark Nodes, call an epoch and check registration", async () => {

    for (i = 0; i < accounts.length; i++) {
      await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[i] });
      await dnr.register(ID(`${i + 1}`), PUBK(`${i + 1}`), MINIMUM_BOND, { from: accounts[i] });
    }

    await waitForEpoch(dnr);
    for (i = 0; i < accounts.length; i++) {
      assert.equal((await dnr.isRegistered(ID(`${i + 1}`))), true);
    }
  })

  it("can not register a node twice", async () => {
    await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[0] });
    await dnr.register(ID("1"), PUBK("1"), MINIMUM_BOND).should.be.rejected;
  })

  it("can not deregister a node which is not registered", async () => {
    await dnr.deregister(ID("-1")).should.be.rejected;
  })

  it("can get the owner of the Dark Node", async () => {
    assert.equal((await dnr.getDarknodeOwner(ID("1"))), accounts[0]);
  })

  it("can get the bond of the Dark Node", async () => {
    assert.equal((await dnr.getBond(ID("1"))), MINIMUM_BOND);
  })

  it("can get the Public Key of the Dark Node", async () => {
    assert.equal((await dnr.getPublicKey(ID("1"))), PUBK("1"));
  })

  it("can deregister a Dark Node, call an epoch and check deregistration", async () => {
    await dnr.deregister(ID("1"), { from: accounts[0] });
    await dnr.deregister(ID("2"), { from: accounts[1] });
    await dnr.deregister(ID("5"), { from: accounts[4] });
    await dnr.deregister(ID("6"), { from: accounts[5] });
    await dnr.deregister(ID("9"), { from: accounts[8] });
    await dnr.deregister(ID("10"), { from: accounts[9] });
    await waitForEpoch(dnr);
    assert.equal((await dnr.isDeregistered(ID("1"))), true);
    assert.equal((await dnr.isDeregistered(ID("2"))), true);
    assert.equal((await dnr.isDeregistered(ID("5"))), true);
    assert.equal((await dnr.isDeregistered(ID("6"))), true);
    assert.equal((await dnr.isDeregistered(ID("9"))), true);
    assert.equal((await dnr.isDeregistered(ID("10"))), true);
  })

  it("can't deregister twice", async () => {
    await dnr.deregister(ID("1"), { from: accounts[0] }).should.be.rejected;
  })

  it("can only get the Dark Nodes that are fully registered", async () => {
    const nodes = await dnr.getDarknodes.call({ gasLimit: 5000000 });
    assert.equal(nodes.length, accounts.length - 6);
    assert.equal(nodes[0], ID("3"));
    assert.equal(nodes[1], ID("4"));
    assert.equal(nodes[2], ID("7"));
    assert.equal(nodes[3], ID("8"));
  })

  it("should fail to refund before deregistering", async () => {
    await dnr.refund(ID("4"), { from: accounts[3] }).should.be.rejected;
  })

  it("can deregister a Dark Node, call an epoch, call refund and check deregistration", async () => {
    await dnr.deregister(ID("3"), { from: accounts[2] });
    await dnr.deregister(ID("4"), { from: accounts[3] });
    await dnr.deregister(ID("7"), { from: accounts[6] });
    await dnr.deregister(ID("8"), { from: accounts[7] });
    await waitForEpoch(dnr);
    assert.equal((await dnr.isDeregistered(ID("3"))), true);
    assert.equal((await dnr.isDeregistered(ID("4"))), true);
    assert.equal((await dnr.isDeregistered(ID("7"))), true);
    assert.equal((await dnr.isDeregistered(ID("8"))), true);
    await dnr.refund(ID("3"), { from: accounts[2] });
    await dnr.refund(ID("4"), { from: accounts[3] });
    await dnr.refund(ID("7"), { from: accounts[6] });
    await dnr.refund(ID("8"), { from: accounts[7] });
    assert.equal((await dnr.isUnregistered(ID("3"))), true);
    assert.equal((await dnr.isUnregistered(ID("4"))), true);
    assert.equal((await dnr.isUnregistered(ID("7"))), true);
    assert.equal((await dnr.isUnregistered(ID("8"))), true);
  })

  it("should fail to refund twice", async () => {
    await dnr.refund(ID("3")).should.be.rejected;
  })

  it("should throw if refund fails", async () => {
    await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[0] });
    await dnr.register(ID("3"), PUBK("3"), MINIMUM_BOND);
    await waitForEpoch(dnr);
    await dnr.deregister(ID("3"));
    await waitForEpoch(dnr);

    await ren.pause();
    await dnr.refund(ID("3")).should.be.rejected;
    await ren.unpause();
    await dnr.refund(ID("3"));
  })

  it("should not refund for an address which is never registered", async () => {
    await dnr.refund(ID("-1")).should.be.rejected;
  })
});

async function waitForEpoch(dnr) {
  const timeout = MINIMUM_EPOCH_INTERVAL * 0.1;
  while (true) {
    // Must be an on-chain call, or the time won't be updated
    try {
      const tx = await dnr.epoch();
      return;
    } catch (err) {
      // epoch reverted, epoch interval hasn't passed
    }
    // Sleep for `timeout` seconds
    await new Promise(resolve => setTimeout(resolve, timeout * 1000));
  }
}
