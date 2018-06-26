const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.should();

const MINIMUM_BOND = 100;
const MINIMUM_POD_SIZE = 72;
const MINIMUM_EPOCH_INTERVAL = 2;

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
    (await dnr.minimumBond()).toNumber().should.equal(0x1);
    await dnr.updateMinimumBond(MINIMUM_BOND, { from: accounts[1] })
      .should.be.rejected;
    await dnr.updateMinimumBond(MINIMUM_BOND);
    (await dnr.minimumBond()).toNumber().should.equal(0x1);
    await waitForEpoch(dnr);
    (await dnr.minimumBond()).toNumber().should.equal(MINIMUM_BOND);
  });

  it("can update minimum pod size", async () => {
    await dnr.updateMinimumPodSize(0x1);
    await waitForEpoch(dnr);
    (await dnr.minimumPodSize()).toNumber().should.equal(0x1);
    await dnr.updateMinimumPodSize(MINIMUM_POD_SIZE, { from: accounts[1] })
      .should.be.rejected;
    await dnr.updateMinimumPodSize(MINIMUM_POD_SIZE);
    (await dnr.minimumPodSize()).toNumber().should.equal(0x1);
    await waitForEpoch(dnr);
    (await dnr.minimumPodSize()).toNumber().should.equal(MINIMUM_POD_SIZE);
  });

  it("can update minimum epoch interval", async () => {
    await dnr.updateEpochInterval(0x1);
    await waitForEpoch(dnr);
    (await dnr.minimumEpochInterval()).toNumber().should.equal(0x1);
    await dnr.updateEpochInterval(MINIMUM_EPOCH_INTERVAL, { from: accounts[1] })
      .should.be.rejected;
    await dnr.updateEpochInterval(MINIMUM_EPOCH_INTERVAL);
    (await dnr.minimumEpochInterval()).toNumber().should.equal(0x1);
    await waitForEpoch(dnr);
    (await dnr.minimumEpochInterval()).toNumber().should.equal(MINIMUM_EPOCH_INTERVAL);
  });

  it("can not register a Dark Node with a bond less than the minimum bond", async () => {
    const lowBond = MINIMUM_BOND - 1;
    await ren.approve(dnr.address, lowBond, { from: accounts[0] });
    await dnr.register("", "", lowBond).should.be.rejected;
    await dnr.register("", "", MINIMUM_BOND).should.be.rejected;
  })

  it("can not call epoch before the minimum time interval", async () => {
    await dnr.epoch();
    await dnr.epoch().should.be.rejected;
  })

  it("can register multiple Dark Nodes, call an epoch and check registration", async () => {

    for (i = 0; i < accounts.length; i++) {
      uid = (i + 1).toString();
      await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[i] });
      await dnr.register(uid, uid, MINIMUM_BOND, { from: accounts[i] });
    }

    await waitForEpoch(dnr);
    for (i = 0; i < accounts.length; i++) {
      uid = (i + 1).toString();
      assert.equal((await dnr.isRegistered(uid)), true);
    }
  })

  it("can not register a node twice", async () => {
    await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[0] });
    await dnr.register("1", "1", MINIMUM_BOND).should.be.rejected;
  })

  it("can not deregister a node which is not registered", async () => {
    await dnr.deregister("").should.be.rejected;
  })

  it("can get the owner of the Dark Node", async () => {
    assert.equal((await dnr.getOwner("1")), accounts[0]);
  })

  it("can get the bond of the Dark Node", async () => {
    assert.equal((await dnr.getBond("1")), MINIMUM_BOND);
  })

  it("can get the Public Key of the Dark Node", async () => {
    assert.equal((await dnr.getPublicKey("1")), "0x");
  })

  it("can deregister a Dark Node, call an epoch and check deregistration", async () => {
    await dnr.deregister("1", { from: accounts[0] });
    await dnr.deregister("2", { from: accounts[1] });
    await dnr.deregister("5", { from: accounts[4] });
    await dnr.deregister("6", { from: accounts[5] });
    await dnr.deregister("9", { from: accounts[8] });
    await dnr.deregister("10", { from: accounts[9] });
    await waitForEpoch(dnr);
    assert.equal((await dnr.isDeregistered("1")), true);
    assert.equal((await dnr.isDeregistered("2")), true);
    assert.equal((await dnr.isDeregistered("5")), true);
    assert.equal((await dnr.isDeregistered("6")), true);
    assert.equal((await dnr.isDeregistered("9")), true);
    assert.equal((await dnr.isDeregistered("10")), true);
  })

  it("can't deregister twice", async () => {
    await dnr.deregister("1", { from: accounts[0] }).should.be.rejected;
  })

  it("can only get the Dark Nodes that are fully registered", async () => {
    const nodes = await dnr.getDarknodes.call({ gasLimit: 5000000 });
    assert.equal(nodes.length, accounts.length - 6);
    assert.equal(nodes[0], "0x3000000000000000000000000000000000000000");
    assert.equal(nodes[1], "0x4000000000000000000000000000000000000000");
    assert.equal(nodes[2], "0x7000000000000000000000000000000000000000");
    assert.equal(nodes[3], "0x8000000000000000000000000000000000000000");
  })

  it("should fail to refund before deregistering", async () => {
    await dnr.refund("4", { from: accounts[3] }).should.be.rejected;
  })

  it("can deregister a Dark Node, call an epoch, call refund and check deregistration", async () => {
    await dnr.deregister("3", { from: accounts[2] });
    await dnr.deregister("4", { from: accounts[3] });
    await dnr.deregister("7", { from: accounts[6] });
    await dnr.deregister("8", { from: accounts[7] });
    await waitForEpoch(dnr);
    assert.equal((await dnr.isDeregistered("3")), true);
    assert.equal((await dnr.isDeregistered("4")), true);
    assert.equal((await dnr.isDeregistered("7")), true);
    assert.equal((await dnr.isDeregistered("8")), true);
    await dnr.refund("3", { from: accounts[2] });
    await dnr.refund("4", { from: accounts[3] });
    await dnr.refund("7", { from: accounts[6] });
    await dnr.refund("8", { from: accounts[7] });
    assert.equal((await dnr.isUnregistered("3")), true);
    assert.equal((await dnr.isUnregistered("4")), true);
    assert.equal((await dnr.isUnregistered("7")), true);
    assert.equal((await dnr.isUnregistered("8")), true);
  })

  it("should fail to refund twice", async () => {
    await dnr.refund("3").should.be.rejected;
  })

  it("should throw if refund fails", async () => {
    await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[0] });
    await dnr.register("3", "1", MINIMUM_BOND);
    await waitForEpoch(dnr);
    await dnr.deregister("3");
    await waitForEpoch(dnr);

    await ren.pause();
    await dnr.refund("3").should.be.rejected;
    await ren.unpause();
    await dnr.refund("3");
  })

  it("should not refund for an address which is never registered", async () => {
    await dnr.refund("").should.be.rejected;
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
