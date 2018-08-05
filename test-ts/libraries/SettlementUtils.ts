const SettlementUtilsTest = artifacts.require("SettlementUtilsTest");
const Orderbook = artifacts.require("Orderbook");
const RepublicToken = artifacts.require("RepublicToken");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");

import { openBuyOrder, openSellOrder, INGRESS_FEE, MINIMUM_BOND, waitForEpoch, PUBK } from "../helper/testUtils";

contract("SettlementUtils", function (accounts: string[]) {

    let settlementTest, orderbook, ren, dnr;
    const broker = accounts[1];
    const darknode = accounts[2];

    before(async function () {
        settlementTest = await SettlementUtilsTest.new();
        orderbook = await Orderbook.deployed();
        ren = await RepublicToken.deployed();
        dnr = await DarknodeRegistry.deployed();

        // Broker
        await ren.transfer(broker, INGRESS_FEE * 10);
        await ren.approve(orderbook.address, INGRESS_FEE * 10, { from: broker });

        // Register darknode
        await ren.transfer(darknode, MINIMUM_BOND);
        await ren.approve(dnr.address, MINIMUM_BOND, { from: darknode });
        await dnr.register(darknode, PUBK("1"), MINIMUM_BOND, { from: darknode });
        await waitForEpoch(dnr);
    });

    it("can verify orders have been confirmed to one another", async () => {
        const buyID_1 = await openBuyOrder(orderbook, broker, accounts[0]);
        const buyID_2 = await openBuyOrder(orderbook, broker, accounts[0]);
        const sellID_1 = await openSellOrder(orderbook, broker, accounts[0]);
        const sellID_2 = await openSellOrder(orderbook, broker, accounts[0]);
        const sellID_3 = await openSellOrder(orderbook, broker, accounts[0]);
        const sellID_4 = await openSellOrder(orderbook, broker, accounts[0]);

        await orderbook.confirmOrder(buyID_1, [sellID_1, sellID_2], { from: darknode });
        await orderbook.confirmOrder(buyID_2, [sellID_3], { from: darknode });

        (await settlementTest.verifyOrderPair(orderbook.address, buyID_1, sellID_1))
            .should.be.true;
        (await settlementTest.verifyOrderPair(orderbook.address, buyID_1, sellID_2))
            .should.be.true;
        // Sell confirmed with another buy
        (await settlementTest.verifyOrderPair(orderbook.address, buyID_1, sellID_3))
            .should.be.false;
        // Sell that isn't confirmed
        (await settlementTest.verifyOrderPair(orderbook.address, buyID_1, sellID_4))
            .should.be.false;
    });

    it("can verify match details", async () => {
        const BUY1 = [web3.utils.sha3("0"), 1, "0x1", 10, 10000, 0];
        const BUY2 = [web3.utils.sha3("0"), 1, "0x1", 11, 10000, 0];
        const SELL = [web3.utils.sha3("0"), 1, "0x100000000", 10, 1000, 0];

        const buyID_1 = await settlementTest.hashOrder(...BUY1);
        const buyID_2 = await settlementTest.hashOrder(...BUY2);
        const sellID = await settlementTest.hashOrder(...SELL);

        await settlementTest.submitOrder(...BUY1);
        await settlementTest.submitOrder(...BUY2);
        await settlementTest.submitOrder(...SELL);

        (await settlementTest.verifyMatchDetails(buyID_1, sellID))
            .should.be.true;
        (await settlementTest.verifyMatchDetails(buyID_2, sellID))
            .should.be.true;
    });

    it("fails for invalid tokens", async () => {
        // Tokens are not compatible
        const BUY = [web3.utils.sha3("0"), 2, "0x1", 1, 1, 0];
        const SELL = [web3.utils.sha3("0"), 2, "0x1", 1, 1, 0];

        const buyID = await settlementTest.hashOrder(...BUY);
        const sellID = await settlementTest.hashOrder(...SELL);
        await settlementTest.submitOrder(...BUY);
        await settlementTest.submitOrder(...SELL);

        (await settlementTest.verifyMatchDetails(buyID, sellID))
            .should.be.false;
    });

    it("fails for invalid price", async () => {
        // Buy price is lower than sell price
        const BUY = [web3.utils.sha3("0"), 2, "0x1", 9, 1, 0];
        const SELL = [web3.utils.sha3("0"), 2, "0x100000000", 10, 1, 0];

        const buyID = await settlementTest.hashOrder(...BUY);
        const sellID = await settlementTest.hashOrder(...SELL);
        await settlementTest.submitOrder(...BUY);
        await settlementTest.submitOrder(...SELL);

        (await settlementTest.verifyMatchDetails(buyID, sellID))
            .should.be.false;
    });

    it("fails for invalid buy volume", async () => {
        // Tokens are not compatible
        const BUY = [web3.utils.sha3("0"), 2, "0x1", 1, 1, 0];
        const SELL = [web3.utils.sha3("0"), 2, "0x100000000", 1, 2, 2];

        const buyID = await settlementTest.hashOrder(...BUY);
        const sellID = await settlementTest.hashOrder(...SELL);
        await settlementTest.submitOrder(...BUY);
        await settlementTest.submitOrder(...SELL);

        (await settlementTest.verifyMatchDetails(buyID, sellID))
            .should.be.false;
    });

    it("fails for invalid sell volume", async () => {
        // Tokens are not compatible
        const BUY = [web3.utils.sha3("0"), 2, "0x1", 1, 2, 2];
        const SELL = [web3.utils.sha3("0"), 2, "0x100000000", 1, 1, 0];

        const buyID = await settlementTest.hashOrder(...BUY);
        const sellID = await settlementTest.hashOrder(...SELL);
        await settlementTest.submitOrder(...BUY);
        await settlementTest.submitOrder(...SELL);

        (await settlementTest.verifyMatchDetails(buyID, sellID))
            .should.be.false;
    });

    it("fails for invalid settlement ID", async () => {
        // Tokens are not compatible
        const BUY = [web3.utils.sha3("0"), 1, "0x1", 1, 1, 0];
        const SELL = [web3.utils.sha3("0"), 2, "0x100000000", 1, 1, 0];

        const buyID = await settlementTest.hashOrder(...BUY);
        const sellID = await settlementTest.hashOrder(...SELL);
        await settlementTest.submitOrder(...BUY);
        await settlementTest.submitOrder(...SELL);

        (await settlementTest.verifyMatchDetails(buyID, sellID))
            .should.be.false;
    });
});
