const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

const MINIMUM_BOND = 100;
const MINIMUM_DARKPOOL_SIZE = 72;
const MINIMUM_EPOCH_INTERVAL = 2;

contract("DarknodeRegistry", function (accounts) {

  let dnr, ren;

  before(async function () {
    ren = await RepublicToken.new();
    dnr = await DarknodeRegistry.new(
      ren.address,
      MINIMUM_BOND,
      MINIMUM_DARKPOOL_SIZE,
      MINIMUM_EPOCH_INTERVAL
    );
    for (i = 1; i < accounts.length; i++) {
      await ren.transfer(accounts[i], MINIMUM_BOND);
    }
  });

  it("can not register a Dark Node with a bond less than the minimum bond", async () => {
    const lowBond = MINIMUM_BOND - 1;
    await ren.approve(dnr.address, lowBond, { from: accounts[0] });
    await dnr.register("", "", lowBond).should.be.rejectedWith();
    await dnr.register("", "", MINIMUM_BOND).should.be.rejectedWith();
  })

  it("can not call epoch before the minimum time interval", async () => {
    await dnr.epoch().should.be.rejectedWith();
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
    await dnr.register("1", "1", MINIMUM_BOND).should.be.rejectedWith();
  })

  it("can not deregister a node which is not registered", async () => {
    await dnr.deregister("").should.be.rejectedWith();
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

  it("can only get the Dark Nodes that are fully registered", async () => {
    const nodes = await dnr.getDarknodes.call({ gasLimit: 5000000 });
    assert.equal(nodes.length, accounts.length - 6);
    assert.equal(nodes[0], "0x3000000000000000000000000000000000000000");
    assert.equal(nodes[1], "0x4000000000000000000000000000000000000000");
    assert.equal(nodes[2], "0x7000000000000000000000000000000000000000");
    assert.equal(nodes[3], "0x8000000000000000000000000000000000000000");
  })

  it("should fail to refund before deregistering", async () => {
    await dnr.refund("4", { from: accounts[3] }).should.be.rejectedWith();
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
    await dnr.refund("3").should.be.rejectedWith();
  })

  it("should not refund for an address which is never registered", async () => {
    await dnr.refund("").should.be.rejectedWith();
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
