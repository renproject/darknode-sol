const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const Orderbook = artifacts.require("Orderbook");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const RepublicToken = artifacts.require("RepublicToken");
const SettlementUtilsTest = artifacts.require("SettlementUtilsTest");

import * as testUtils from "./helper/testUtils";
import { INGRESS_FEE, MINIMUM_BOND } from "./helper/testUtils";
import { BN } from "bn.js";

contract("Darknode Slasher", function (accounts: string[]) {

    let dnr, ren, orderbook, slasher, settlementTest;
    const [darknode5, darknode6, darknode7] = [accounts[5], accounts[6], accounts[7]];
    const broker = accounts[0];

    before(async function () {
        settlementTest = await SettlementUtilsTest.new();

        ren = await RepublicToken.deployed();
        dnr = await DarknodeRegistry.deployed();
        orderbook = await Orderbook.deployed();
        slasher = await DarknodeSlasher.deployed();

        // Broker
        await ren.transfer(broker, INGRESS_FEE * 10);
        await ren.approve(orderbook.address, INGRESS_FEE * 10, { from: broker });

        // Register 3 darknodes
        await ren.transfer(accounts[1], MINIMUM_BOND);
        await ren.transfer(accounts[2], MINIMUM_BOND);
        await ren.transfer(accounts[3], MINIMUM_BOND);

        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[1] });
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[2] });
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[3] });

        await dnr.register(darknode5, testUtils.PUBK("1"), MINIMUM_BOND, { from: accounts[1] });
        await dnr.register(darknode6, testUtils.PUBK("2"), MINIMUM_BOND, { from: accounts[2] });
        await dnr.register(darknode7, testUtils.PUBK("3"), MINIMUM_BOND, { from: accounts[3] });
        await testUtils.waitForEpoch(dnr);

        (await dnr.isRegistered(darknode5)).should.be.true;
        (await dnr.isRegistered(darknode6)).should.be.true;
        (await dnr.isRegistered(darknode7)).should.be.true;

        (await dnr.isDeregisterable(darknode5)).should.be.true;
        (await dnr.isDeregisterable(darknode6)).should.be.true;
        (await dnr.isDeregisterable(darknode7)).should.be.true;
    });

    it("anyone other than registered darknodes cannot submit challenge order", async () => {
        const ORDER = [web3.utils.sha3("1"), 1, "0x100000000", 10, 1000, 0];

        await slasher.submitChallengeOrder(...ORDER, { from: accounts[1] })
            .should.be.rejectedWith(null, /must be darknode/);
    });

    it("should fail to submit challenge order twice", async () => {
        const ORDER = [web3.utils.sha3("2"), 1, "0x100000000", 10, 1000, 0];
        await slasher.submitChallengeOrder(...ORDER, { from: darknode5 });

        await slasher.submitChallengeOrder(...ORDER, { from: darknode5 })
            .should.be.rejectedWith(null, /already submitted/);
    });

    it("bonds can be slashed for wrongful order confirmations", async () => {
        const BUY = [web3.utils.sha3("3"), 2, "0x100000000", 10, 1, 2];
        const SELL = [web3.utils.sha3("4"), 2, "0x1", 10, 1, 2];

        await slasher.submitChallengeOrder(...BUY, { from: darknode5 });
        await slasher.submitChallengeOrder(...SELL, { from: darknode6 });

        let buyID = await settlementTest.hashOrder(...BUY);
        let sellID = await settlementTest.hashOrder(...SELL);

        await testUtils.openBuyOrder(orderbook, broker, accounts[8], buyID);
        await testUtils.openSellOrder(orderbook, broker, accounts[9], sellID);
        await orderbook.confirmOrder(buyID, sellID, { from: darknode7 });

        // The confirmer's bond will be halved
        const bondBefore = await dnr.getDarknodeBond(darknode7);
        await slasher.submitChallenge(buyID, sellID);
        let bondAfter = await dnr.getDarknodeBond(darknode7);
        bondAfter.mul(new BN(2)).should.bignumber.equal(bondBefore);
    });

    it("challenges can't be submitted multiple times", async () => {
        const BUY = [web3.utils.sha3("5"), 2, "0x100000000", 10, 1, 2];
        const SELL = [web3.utils.sha3("6"), 2, "0x1", 10, 1, 2];

        await slasher.submitChallengeOrder(...BUY, { from: darknode5 });
        await slasher.submitChallengeOrder(...SELL, { from: darknode6 });

        let buyID = await settlementTest.hashOrder(...BUY);
        let sellID = await settlementTest.hashOrder(...SELL);

        await testUtils.openBuyOrder(orderbook, broker, accounts[8], buyID);
        await testUtils.openSellOrder(orderbook, broker, accounts[9], sellID);
        await orderbook.confirmOrder(buyID, sellID, { from: darknode7 });

        await slasher.submitChallenge(buyID, sellID);

        // Slashing (and with orders swapped) should be rejected
        await slasher.submitChallenge(buyID, sellID)
            .should.be.rejectedWith(/already challenged/);
        await slasher.submitChallenge(sellID, buyID)
            .should.be.rejectedWith(/already challenged/);
    });

    it("matched orders do not get punished", async () => {
        const BUY = [web3.utils.sha3("6"), 1, "0x100000000", 10, 1000, 0];
        const SELL = [web3.utils.sha3("7"), 1, "0x1", 10, 10000, 0];

        await slasher.submitChallengeOrder(...BUY, { from: darknode5 });
        await slasher.submitChallengeOrder(...SELL, { from: darknode6 });

        let sellID = await settlementTest.hashOrder(...BUY);
        let buyID = await settlementTest.hashOrder(...SELL);
        await testUtils.openBuyOrder(orderbook, broker, accounts[8], buyID);
        await testUtils.openSellOrder(orderbook, broker, accounts[9], sellID);
        await orderbook.confirmOrder(buyID, sellID, { from: darknode7 });

        // Slash should be rejected
        await slasher.submitChallenge(buyID, sellID)
            .should.be.rejectedWith(/invalid challenge/);
    });

    it("non-confirmed orders do not get punished", async () => {
        const BUY = [web3.utils.sha3("7"), 1, "0x100000000", 1, 1, 0];
        const SELL = [web3.utils.sha3("8"), 1, "0x1", 1, 1, 0];

        await slasher.submitChallengeOrder(...BUY, { from: darknode5 });
        await slasher.submitChallengeOrder(...SELL, { from: darknode6 });

        let sellID = await settlementTest.hashOrder(...BUY);
        let buyID = await settlementTest.hashOrder(...SELL);
        await testUtils.openBuyOrder(orderbook, broker, accounts[8], buyID);
        await testUtils.openSellOrder(orderbook, broker, accounts[9], sellID);

        // Slash should be rejected
        await slasher.submitChallenge(buyID, sellID)
            .should.be.rejectedWith(/unconfirmed orders/);
    });

    it("can't slash if order details haven't been submitted", async () => {
        const BUY = [web3.utils.sha3("8"), 1, "0x100000000", 1, 1, 0];
        const SELL = [web3.utils.sha3("9"), 1, "0x1", 1, 1, 0];

        let buyID = await settlementTest.hashOrder(...BUY);
        let sellID = await settlementTest.hashOrder(...SELL);

        // Slash should be rejected if buy details aren't available
        await slasher.submitChallenge(buyID, sellID)
            .should.be.rejectedWith(/details unavailable/);

        await slasher.submitChallengeOrder(...BUY, { from: darknode5 });

        // Slash should be rejected if sell details aren't available
        await slasher.submitChallenge(buyID, sellID)
            .should.be.rejectedWith(/details unavailable/);
    });
});
