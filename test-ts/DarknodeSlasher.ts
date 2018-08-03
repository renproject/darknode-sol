const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const Orderbook = artifacts.require("Orderbook");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const RepublicToken = artifacts.require("RepublicToken");
const SettlementUtilsTest = artifacts.require("SettlementUtilsTest");

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
chai.should();

const MINIMUM_BOND = 100;
const MINIMUM_POD_SIZE = 72;
const MINIMUM_EPOCH_INTERVAL = 2;

const FEE = 0;

// Makes a public key for a darknode
function PUBK(i: string) {
  return web3.utils.sha3(i);
}

contract("Darknode Slasher", function (accounts: string[]) {

  let expiry, dnrs, dnr, ren, orderbook, slasher, settlementTest;

  before(async function () {
    expiry = Math.floor(Date.now() / 1000 + (24 * 60 * 60));

    settlementTest = await SettlementUtilsTest.new();
    ren = await RepublicToken.new();  
    dnrs = await DarknodeRegistryStore.new(ren.address);
    dnr = await DarknodeRegistry.new(
      ren.address,
      dnrs.address,
      MINIMUM_BOND,
      MINIMUM_POD_SIZE,
      MINIMUM_EPOCH_INTERVAL
    );
    dnrs.transferOwnership(dnr.address);

    await ren.transfer(accounts[1], MINIMUM_BOND);
    await ren.transfer(accounts[2], MINIMUM_BOND);
    await ren.transfer(accounts[3], MINIMUM_BOND);

    orderbook = await Orderbook.new(FEE, ren.address, dnr.address);
    slasher = await DarknodeSlasher.new(dnr.address, orderbook.address);
    await dnr.updateSlasher(slasher.address);

    await ren.approve(dnr.address, MINIMUM_BOND, {from: accounts[1]});
    await ren.approve(dnr.address, MINIMUM_BOND, {from: accounts[2]});
    await ren.approve(dnr.address, MINIMUM_BOND, {from: accounts[3]});

    await web3.eth.sendTransaction({from: accounts[0], to: accounts[5], value: 1000000000000000000});
    await web3.eth.sendTransaction({from: accounts[0], to: accounts[6], value: 1000000000000000000});
    await web3.eth.sendTransaction({from: accounts[0], to: accounts[7], value: 1000000000000000000});

    await dnr.register(accounts[5], PUBK("1"), MINIMUM_BOND, {from:accounts[1]});
    await dnr.register(accounts[6], PUBK("2"), MINIMUM_BOND, {from:accounts[2]});
    await dnr.register(accounts[7], PUBK("3"), MINIMUM_BOND, {from:accounts[3]});
    await waitForEpoch(dnr);

    (await dnr.isRegistered(accounts[5])).should.be.true;
    (await dnr.isRegistered(accounts[6])).should.be.true;
    (await dnr.isRegistered(accounts[7])).should.be.true;

    (await dnr.isDeregisterable(accounts[5])).should.be.true;
    (await dnr.isDeregisterable(accounts[6])).should.be.true;
    (await dnr.isDeregisterable(accounts[7])).should.be.true;
  });

  it("darknode can submit challenge order", async() => {
    await slasher.submitChallengeOrder(web3.utils.sha3("0"), 1, "0x100000000", 10, 1000, 0, {from: accounts[5]});
    await slasher.submitChallengeOrder(web3.utils.sha3("0"), 1, "0x1", 10, 10000, 0, {from: accounts[6]});

    await slasher.submitChallengeOrder(web3.utils.sha3("0"), 2, "0x100000000", 10, 1000, 0, {from: accounts[5]});
    await slasher.submitChallengeOrder(web3.utils.sha3("0"), 2, "0x1", 9, 10000, 0, {from: accounts[6]});
  });

  it("anyone other than registered darknodes cannot submit challenge order", async() => {
    await slasher.submitChallengeOrder(web3.utils.sha3("0"), 2, "0x100000000", 10, 1000, 0, {from: accounts[1]}).should.be.rejectedWith(null, /revert/);
    await slasher.submitChallengeOrder(web3.utils.sha3("0"), 2, "0x1", 9, 10000, 0, {from: accounts[2]}).should.be.rejectedWith(null, /revert/);
  });

  it("should fail to submit challenge order twice", async() => {
    await slasher.submitChallengeOrder(web3.utils.sha3("0"), 1, "0x100000000", 10, 1000, 0, {from: accounts[5]}).should.be.rejectedWith(null, /revert/);
    await slasher.submitChallengeOrder(web3.utils.sha3("0"), 1, "0x1", 10, 10000, 0, {from: accounts[6]}).should.be.rejectedWith(null, /revert/);
  });

  it("mismatched orders get punished", async() => {
    let sellID = await settlementTest.hashOrder(web3.utils.sha3("0"), 2, "0x100000000", 10, 1000, 0);
    let buyID = await settlementTest.hashOrder(web3.utils.sha3("0"), 2, "0x1", 9, 10000, 0);
    await steps.openBuyOrder(orderbook, accounts[0], accounts[7], buyID);
    await steps.openSellOrder(orderbook, accounts[0], accounts[8], sellID);
    await orderbook.confirmOrder(buyID, [sellID], {from: accounts[7]});
    await slasher.submitChallenge(buyID, sellID);
  });

  it("matched orders do not get punished", async() => {
    let sellID = await settlementTest.hashOrder(web3.utils.sha3("0"), 1, "0x100000000", 10, 1000, 0);
    let buyID = await settlementTest.hashOrder(web3.utils.sha3("0"), 1, "0x1", 10, 10000, 0);
    await steps.openBuyOrder(orderbook, accounts[0], accounts[7], buyID);
    await steps.openSellOrder(orderbook, accounts[0], accounts[8], sellID);
    await orderbook.confirmOrder(buyID, [sellID], {from: accounts[7]});
    await slasher.submitChallenge(buyID, sellID).should.be.rejectedWith(/revert/);
  });
});

const openPrefix = web3.utils.toHex("Republic Protocol: open: ");
const closePrefix = web3.utils.toHex("Republic Protocol: cancel: ");

const steps = {
    openBuyOrder: async (orderbook, broker, account, orderID) => {
        let hash = openPrefix + orderID.slice(2);
        let signature = await web3.eth.sign(hash, account);
        await orderbook.openBuyOrder(signature, orderID, { from: broker });
        return orderID;
    },

    openSellOrder: async (orderbook, broker, account, orderID) => {
        let hash = openPrefix + orderID.slice(2);
        let signature = await web3.eth.sign(hash, account);
        await orderbook.openSellOrder(signature, orderID, { from: broker });
        return orderID;
    },

    cancelOrder: async (orderbook, broker, account, orderID) => {
        const hash = closePrefix + orderID.slice(2);
        const signature = await web3.eth.sign(hash, account);
        await orderbook.cancelOrder(signature, orderID, { from: broker });
    }
};


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
