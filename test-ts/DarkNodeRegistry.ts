const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const RepublicToken = artifacts.require("RepublicToken");

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
chai.should();

const MINIMUM_BOND = 100;
const MINIMUM_POD_SIZE = 72;
const MINIMUM_EPOCH_INTERVAL = 2;

// Makes an ID for a darknode
function ID(i: string) {
  return web3.utils.sha3(i).slice(0, 42);
}

// Makes a public key for a darknode
function PUBK(i: string) {
  return web3.utils.sha3(i);
}

contract("DarknodeRegistry", function (accounts: string[]) {

  let dnrs, dnr, ren;

  before(async function () {
    ren = await RepublicToken.new();
    dnrs = await DarknodeRegistryStore.new(ren.address);
    dnr = await DarknodeRegistry.new(
      ren.address,
      dnrs.address,
      MINIMUM_BOND,
      MINIMUM_POD_SIZE,
      MINIMUM_EPOCH_INTERVAL
    );
    dnr.updateSlasher(accounts[3]);
    dnrs.transferOwnership(dnr.address);
    for (let i = 1; i < accounts.length; i++) {
      await ren.transfer(accounts[i], MINIMUM_BOND);
    }
  });

  it("can update minimum bond", async () => {
    await dnr.updateMinimumBond(0x1);
    await waitForEpoch(dnr);
    (await dnr.minimumBond()).toNumber().should.equal(1);
    await dnr.updateMinimumBond(MINIMUM_BOND, { from: accounts[1] })
      .should.be.rejectedWith(null, /revert/); // not owner
    await dnr.updateMinimumBond(MINIMUM_BOND);
    (await dnr.minimumBond()).toNumber().should.equal(1);
    await waitForEpoch(dnr);
    (await dnr.minimumBond()).toNumber().should.equal(MINIMUM_BOND);
  });

  it("can update minimum pod size", async () => {
    await dnr.updateMinimumPodSize(0x0);
    await waitForEpoch(dnr);
    (await dnr.minimumPodSize()).toNumber().should.equal(0);
    await dnr.updateMinimumPodSize(MINIMUM_POD_SIZE, { from: accounts[1] })
      .should.be.rejectedWith(null, /revert/); // not owner
    await dnr.updateMinimumPodSize(MINIMUM_POD_SIZE);
    (await dnr.minimumPodSize()).toNumber().should.equal(0);
    await waitForEpoch(dnr);
    (await dnr.minimumPodSize()).toNumber().should.equal(MINIMUM_POD_SIZE);
  });

  it("can update minimum epoch interval", async () => {
    await dnr.updateMinimumEpochInterval(0x0);
    await waitForEpoch(dnr);
    (await dnr.minimumEpochInterval()).toNumber().should.equal(0);
    await dnr.updateMinimumEpochInterval(MINIMUM_EPOCH_INTERVAL, { from: accounts[1] })
      .should.be.rejectedWith(null, /revert/); // not owner
    await dnr.updateMinimumEpochInterval(MINIMUM_EPOCH_INTERVAL);
    (await dnr.minimumEpochInterval()).toNumber().should.equal(0);
    await waitForEpoch(dnr);
    (await dnr.minimumEpochInterval()).toNumber().should.equal(MINIMUM_EPOCH_INTERVAL);
  });

  it("can not register a Dark Node with a bond less than the minimum bond", async () => {
    const lowBond = MINIMUM_BOND - 1;
    await ren.approve(dnr.address, lowBond, { from: accounts[0] });
    await dnr.register(ID("A"), PUBK("A"), lowBond).should.be.rejectedWith(null, /insufficient bond/);
    await dnr.register(ID("A"), PUBK("A"), MINIMUM_BOND).should.be.rejectedWith(null, /revert/); // failed transfer
  });

  it("can not call epoch before the minimum time interval", async () => {
    await dnr.epoch();
    await dnr.epoch().should.be.rejectedWith(null, /revert/); // TODO: Why isn't reason returned?
  });

  it("can register multiple Dark Nodes, call an epoch and check registration", async () => {
    for (let i = 0; i < accounts.length; i++) {
      await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[i] });
      await dnr.register(ID(`${i + 1}`), PUBK(`${i + 1}`), MINIMUM_BOND, { from: accounts[i] });
    }
    for (let i = 0; i < accounts.length; i++) {
      (await dnr.isPendingRegistration(ID(`${i + 1}`))).should.be.true;
    }

    await waitForEpoch(dnr);
    for (let i = 0; i < accounts.length; i++) {
      (await dnr.isRegistered(ID(`${i + 1}`))).should.be.true;
    }
  });

  it("can not register a node twice", async () => {
    await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[0] });
    await dnr.register(ID("1"), PUBK("1"), MINIMUM_BOND).should.be.rejectedWith(null, /must be refunded or never registered/);
  });

  it("can not deregister a node which is not registered", async () => {
    await dnr.deregister(ID("-1")).should.be.rejectedWith(null, /must be deregisterable/);
  });

  it("can get the owner of the Dark Node", async () => {
    (await dnr.getDarknodeOwner(ID("1"))).should.equal(accounts[0]);
  });

  it("can get the bond of the Dark Node", async () => {
    (await dnr.getDarknodeBond(ID("1"))).toNumber().should.equal(MINIMUM_BOND);
  });

  it("can get the Public Key of the Dark Node", async () => {
    (await dnr.getDarknodePublicKey(ID("1"))).should.equal(PUBK("1"));
  });

  it("can deregister a Dark Node, call an epoch and check deregistration", async () => {
    await dnr.deregister(ID("1"), { from: accounts[0] });
    await dnr.deregister(ID("2"), { from: accounts[1] });
    await dnr.deregister(ID("5"), { from: accounts[4] });
    await dnr.deregister(ID("6"), { from: accounts[5] });
    await dnr.deregister(ID("9"), { from: accounts[8] });
    await dnr.deregister(ID("10"), { from: accounts[9] });
    await waitForEpoch(dnr);
    (await dnr.isDeregistered(ID("1"))).should.be.true;
    (await dnr.isDeregistered(ID("2"))).should.be.true;
    (await dnr.isDeregistered(ID("5"))).should.be.true;
    (await dnr.isDeregistered(ID("6"))).should.be.true;
    (await dnr.isDeregistered(ID("9"))).should.be.true;
    (await dnr.isDeregistered(ID("10"))).should.be.true;
  });

  it("can't deregister twice", async () => {
    await dnr.deregister(ID("1"), { from: accounts[0] }).should.be.rejectedWith(null, /must be deregisterable/);
  });

  it("can only get the Dark Nodes that are fully registered", async () => {
    const nodes = await dnr.getDarknodes.call({ gasLimit: 5000000 });
    (nodes.length).should.equal(accounts.length - 6);
    nodes[0].toLowerCase().should.equal(ID("3"));
    nodes[1].toLowerCase().should.equal(ID("4"));
    nodes[2].toLowerCase().should.equal(ID("7"));
    nodes[3].toLowerCase().should.equal(ID("8"));
  });

  it("should fail to refund before deregistering", async () => {
    await dnr.refund(ID("4"), { from: accounts[3] }).should.be.rejectedWith(null, /must be deregistered/);
  });

  it("can deregister a Dark Node, call an epoch, call refund and check deregistration", async () => {
    await dnr.deregister(ID("3"), { from: accounts[2] });
    await dnr.deregister(ID("4"), { from: accounts[3] });
    await dnr.deregister(ID("7"), { from: accounts[6] });
    await dnr.deregister(ID("8"), { from: accounts[7] });
    (await dnr.isPendingDeregistration(ID("3"))).should.be.true;
    (await dnr.isPendingDeregistration(ID("4"))).should.be.true;
    (await dnr.isPendingDeregistration(ID("7"))).should.be.true;
    (await dnr.isPendingDeregistration(ID("8"))).should.be.true;
    await waitForEpoch(dnr);
    (await dnr.isRegisteredInPreviousEpoch(ID("3"))).should.be.true;
    (await dnr.isRegisteredInPreviousEpoch(ID("4"))).should.be.true;
    (await dnr.isRegisteredInPreviousEpoch(ID("7"))).should.be.true;
    (await dnr.isRegisteredInPreviousEpoch(ID("8"))).should.be.true;
    (await dnr.isDeregistered(ID("3"))).should.be.true;
    (await dnr.isDeregistered(ID("4"))).should.be.true;
    (await dnr.isDeregistered(ID("7"))).should.be.true;
    (await dnr.isDeregistered(ID("8"))).should.be.true;
    let previousDarknodesEpoch1 = await dnr.getPreviousDarknodes();
    await waitForEpoch(dnr);
    let previousDarknodesEpoch2 = await dnr.getPreviousDarknodes();
    (previousDarknodesEpoch1.length - previousDarknodesEpoch2.length).should.be.equal(4);
    (await dnr.isDeregistered(ID("3"))).should.be.true;
    (await dnr.isDeregistered(ID("4"))).should.be.true;
    (await dnr.isDeregistered(ID("7"))).should.be.true;
    (await dnr.isDeregistered(ID("8"))).should.be.true;
    await dnr.refund(ID("3"), { from: accounts[2] });
    await dnr.refund(ID("4"), { from: accounts[3] });
    await dnr.refund(ID("7"), { from: accounts[6] });
    await dnr.refund(ID("8"), { from: accounts[7] });
    (await dnr.isRefunded(ID("3"))).should.be.true;
    (await dnr.isRefunded(ID("4"))).should.be.true;
    (await dnr.isRefunded(ID("7"))).should.be.true;
    (await dnr.isRefunded(ID("8"))).should.be.true;
    (await ren.balanceOf(accounts[2])).toNumber().should.equal(MINIMUM_BOND);
    (await ren.balanceOf(accounts[3])).toNumber().should.equal(MINIMUM_BOND);
    (await ren.balanceOf(accounts[6])).toNumber().should.equal(MINIMUM_BOND);
    (await ren.balanceOf(accounts[7])).toNumber().should.equal(MINIMUM_BOND);
  });

  it("should fail to refund twice", async () => {
    await dnr.refund(ID("3")).should.be.rejectedWith(null, /must be darknode owner/);
  });

  it("should throw if refund fails", async () => {
    await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[0] });
    await dnr.register(ID("3"), PUBK("3"), MINIMUM_BOND);
    await waitForEpoch(dnr);
    await dnr.deregister(ID("3"));
    await waitForEpoch(dnr);
    await waitForEpoch(dnr);
    await waitForEpoch(dnr);

    await ren.pause();
    await dnr.refund(ID("3")).should.be.rejectedWith(null, /revert/);
    await ren.unpause();
    await dnr.refund(ID("3"));
  });

  it("should not refund for an address which is never registered", async () => {
    await dnr.refund(ID("-1")).should.be.rejectedWith(null, /must be darknode owner/);
  });

  it("can slash a darknode", async () => {
    await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[2] });
    await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[6] });
    await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[7] });
    await dnr.register(ID("3"), PUBK("3"), MINIMUM_BOND, { from: accounts[2] });
    await dnr.register(ID("7"), PUBK("7"), MINIMUM_BOND, { from: accounts[6] });
    await dnr.register(ID("8"), PUBK("8"), MINIMUM_BOND, { from: accounts[7] });
    await waitForEpoch(dnr);
    await dnr.slash(ID("3"), ID("7"), ID("8"), {from: accounts[3]});
  });

  it("transfer ownership of the dark node store", async () => {
    await dnr.transferStoreOwnership(accounts[0]);
  });

});

async function waitForEpoch(dnr: any) {
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
