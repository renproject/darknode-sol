const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const Orderbook = artifacts.require("Orderbook");

import * as testUtils from "./helper/testUtils";
import { INGRESS_FEE, MINIMUM_BOND } from "./helper/testUtils";

contract("Orderbook", function (accounts: string[]) {

    let ren, dnr, orderbook, darknode, broker;

    before(async function () {
        ren = await RepublicToken.deployed();
        dnr = await DarknodeRegistry.deployed();
        orderbook = await Orderbook.deployed();

        // The following tests rely on accounts not being empty
        accounts.length.should.be.greaterThan(0);
        for (let i = 0; i < accounts.length; i++) {
            await ren.transfer(accounts[i], MINIMUM_BOND);
        }

        // Register all nodes
        darknode = accounts[8];
        await ren.approve(dnr.address, MINIMUM_BOND, { from: darknode });

        await dnr.register(darknode, "0x00", MINIMUM_BOND, { from: darknode });

        await dnr.epoch();

        broker = accounts[9];
    });

    it("can update the fee", async () => {
        await orderbook.updateFee(0x1);
        (await orderbook.fee()).should.bignumber.equal(1);
        await orderbook.updateFee(INGRESS_FEE, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // not owner
        await orderbook.updateFee(INGRESS_FEE);
        (await orderbook.fee()).should.bignumber.equal(INGRESS_FEE);
    });

    it("can update the darknode registry address", async () => {
        await orderbook.updateDarknodeRegistry(0x0);
        (await orderbook.darknodeRegistry()).should.equal("0x0000000000000000000000000000000000000000");
        await orderbook.updateDarknodeRegistry(dnr.address, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // not owner
        await orderbook.updateDarknodeRegistry(dnr.address);
        (await orderbook.darknodeRegistry()).should.equal(dnr.address);
    });

    it("should be able to open orders", async function () {
        await ren.approve(orderbook.address, 2 * accounts.length * INGRESS_FEE, { from: broker });
        for (let i = 0; i < accounts.length; i++) {
            await testUtils.openBuyOrder(orderbook, broker, accounts[i]);
            await testUtils.openSellOrder(orderbook, broker, accounts[i]);
        }
    });

    it("should be rejected when trying to open an order without no REN allowance", async function () {
        (INGRESS_FEE).should.be.greaterThan(0, "Can't run test if Ingress fee is 0");
        await ren.approve(orderbook.address, 0, { from: broker });
        await testUtils.openBuyOrder(orderbook, broker, accounts[0])
            .should.be.rejectedWith(null, /revert/); // erc20 transfer error
        await testUtils.openSellOrder(orderbook, broker, accounts[0])
            .should.be.rejectedWith(null, /revert/); // erc20 transfer error
    });

    it("should be rejected when trying to open an opened order", async function () {
        for (let i = 0; i < accounts.length; i++) {
            await ren.approve(orderbook.address, 2 * INGRESS_FEE, { from: broker });

            const orderID = await testUtils.openBuyOrder(orderbook, broker, accounts[0]);
            await testUtils.openBuyOrder(orderbook, broker, accounts[0], orderID)
                .should.be.rejectedWith(null, /invalid order status/);

            await testUtils.openSellOrder(orderbook, broker, accounts[0], orderID)
                .should.be.rejectedWith(null, /invalid order status/);
        }
    });

    it("should be able to cancel orders", async function () {
        const ids = {};

        await ren.approve(orderbook.address, accounts.length * 2 * INGRESS_FEE, { from: broker });

        for (let i = 0; i < accounts.length; i++) {
            ids[i] = (i % 2 === 0) ?
                await testUtils.openBuyOrder(orderbook, broker, accounts[i]) :
                await testUtils.openSellOrder(orderbook, broker, accounts[i]);
        }

        for (let i = 0; i < accounts.length; i++) {
            await testUtils.cancelOrder(orderbook, broker, accounts[i], ids[i]);
        }
    });

    it("should be able to cancel orders that are not open", async function () {
        await ren.approve(orderbook.address, INGRESS_FEE, { from: broker });

        let orderID = testUtils.randomID();
        await testUtils.cancelOrder(orderbook, broker, accounts[0], orderID);
    });

    it("should not be able to cancel confirmed orders", async function () {
        await ren.approve(orderbook.address, 5 * INGRESS_FEE, { from: broker });

        // Confirmed Order
        let confirmedOrder = await testUtils.openBuyOrder(orderbook, broker, accounts[1]);
        let match = await testUtils.openSellOrder(orderbook, broker, accounts[3]);
        await orderbook.confirmOrder(confirmedOrder, [match], { from: darknode });

        await testUtils.cancelOrder(orderbook, broker, accounts[1], confirmedOrder)
            .should.be.rejectedWith(null, /invalid order state/);

        await testUtils.cancelOrder(orderbook, broker, accounts[3], match)
            .should.be.rejectedWith(null, /invalid order state/);
    });

    it("should be rejected when trying to cancel orders signed by someone else", async function () {
        const ids = {};

        await ren.approve(orderbook.address, accounts.length * INGRESS_FEE, { from: broker });

        for (let i = 0; i < accounts.length; i++) {
            ids[i] = (i % 2 === 0) ?
                await testUtils.openBuyOrder(orderbook, broker, accounts[i]) :
                await testUtils.openSellOrder(orderbook, broker, accounts[i]);
        }

        for (let i = 0; i < accounts.length; i++) {
            await ren.approve(orderbook.address, INGRESS_FEE, { from: accounts[i] });
            await testUtils.cancelOrder(orderbook, broker, accounts[(i + 1) % accounts.length], ids[i])
                .should.be.rejectedWith(null, /invalid signature/);
        }
    });

    it("should be able to confirm orders", async function () {
        const buyIDs = {};
        const sellIDs = {};

        await ren.approve(orderbook.address, 2 * (accounts.length / 2) * INGRESS_FEE, { from: broker });

        // Open orders
        for (let i = 0; i < accounts.length / 2; i++) {

            buyIDs[i] = await testUtils.openBuyOrder(orderbook, broker, accounts[i]);
            sellIDs[i] = await testUtils.openSellOrder(orderbook, broker, accounts[accounts.length - 1 - i]);
        }

        // Confirm orders
        for (let i = 0; i < accounts.length / 2; i++) {
            await orderbook.confirmOrder(buyIDs[i], [sellIDs[i]], { from: darknode });
        }
    });

    it("should be rejected when trying to confirm an non-open order", async function () {
        // Setup
        await ren.approve(orderbook.address, 5 * INGRESS_FEE, { from: broker });

        // Opened Order
        let openedOrder = await testUtils.openBuyOrder(orderbook, broker, accounts[0]);

        // Confirmed Order
        let confirmedOrder = await testUtils.openSellOrder(orderbook, broker, accounts[1]);
        let match = await testUtils.openBuyOrder(orderbook, broker, accounts[3]);
        await orderbook.confirmOrder(confirmedOrder, [match], { from: darknode });

        // Canceled order
        let canceledOrder = await testUtils.openSellOrder(orderbook, broker, accounts[1]);
        await testUtils.cancelOrder(orderbook, broker, accounts[1], canceledOrder);

        // Unopened Order
        let unopenedOrder = testUtils.randomID();

        await orderbook.confirmOrder(confirmedOrder, [openedOrder], { from: darknode })
            .should.be.rejectedWith(null, /invalid order status/);
        await orderbook.confirmOrder(openedOrder, [confirmedOrder], { from: darknode })
            .should.be.rejectedWith(null, /invalid order status/);

        await orderbook.confirmOrder(unopenedOrder, [openedOrder], { from: darknode })
            .should.be.rejectedWith(null, /invalid order status/);
        await orderbook.confirmOrder(openedOrder, [unopenedOrder], { from: darknode })
            .should.be.rejectedWith(null, /invalid order status/);

        await orderbook.confirmOrder(canceledOrder, [openedOrder], { from: darknode })
            .should.be.rejectedWith(null, /invalid order status/);
        await orderbook.confirmOrder(openedOrder, [canceledOrder], { from: darknode })
            .should.be.rejectedWith(null, /invalid order status/);
    });

    it("should be rejected when an un-registered node trying to confirm orders", async function () {
        await ren.approve(orderbook.address, 2 * INGRESS_FEE, { from: accounts[0] });
        let order1 = testUtils.randomID();
        let order2 = testUtils.randomID();

        await orderbook.confirmOrder(order1, [order2], { from: accounts[1] })
            .should.be.rejectedWith(null, /must be registered darknode/);
        await orderbook.confirmOrder(order2, [order1], { from: accounts[1] })
            .should.be.rejectedWith(null, /must be registered darknode/);
    });

    it("should be able to get the depth of orderID", async function () {

        await ren.approve(orderbook.address, INGRESS_FEE, { from: broker });

        let orderID = testUtils.randomID();

        (await orderbook.orderDepth.call(orderID)).toNumber()
            .should.equal(0);

        await testUtils.openBuyOrder(orderbook, broker, accounts[0], orderID);

        (await orderbook.orderDepth.call(orderID)).toNumber()
            .should.equal(1);
    });

    it("should be able to retrieve orders", async function () {
        const _orderbook = await Orderbook.new(1, ren.address, dnr.address);

        const ids = {};

        await ren.approve(_orderbook.address, 2 * accounts.length * INGRESS_FEE, { from: broker });
        for (let i = 0; i < accounts.length; i++) {
            ids[i] = (i % 2 === 0) ?
                await testUtils.openBuyOrder(_orderbook, broker, accounts[i]) :
                await testUtils.openSellOrder(_orderbook, broker, accounts[i]);
        }

        const offset = 1;
        const orders = await _orderbook.getOrders(offset, accounts.length - offset);

        orders[0].length.should.equal(accounts.length - offset);

        for (let i = 0; i < accounts.length - offset; i++) {
            // IDs
            orders[0][i].should.equal(ids[i + offset]);
            // Traders
            orders[1][i].should.equal(accounts[i + offset]);
            // Status
            orders[2][i].should.bignumber.equal(1);
        }

        (await _orderbook.getOrders(10000, 1))
            .should.deep.equal({ 0: [], 1: [], 2: [] });

        (await _orderbook.getOrders(0, 10000))[0]
            .length.should.equal(accounts.length);
    });

    it("should be able to retrieve trader from signature", async function () {
        const id = "0x6b461b846c349ffe77d33c77d92598cfff854ef2aabe72567cd844be75261b9d";

        // tslint:disable:max-line-length
        const data = "0x52657075626c69632050726f746f636f6c3a206f70656e3a206b461b846c349ffe77d33c77d92598cfff854ef2aabe72567cd844be75261b9d";
        const signature = "0x5f9b4834c252960cec91116f1138262cca723a579dfc1a3405c9900862c63a415885c79d1e8ced229cfc753df6db88309141a7c1a2478d2d77956982288868311b";
        // tslint:enable:max-line-length

        let prefix = web3.utils.toHex("Republic Protocol: open: ");
        data.should.equal((prefix + id.slice(2)));

        await ren.approve(orderbook.address, INGRESS_FEE, { from: accounts[0] });
        await orderbook.openBuyOrder(signature, id, { from: accounts[0] });
        (await orderbook.orderTrader.call(id)).should.equal("0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66");
    });

    it("should be able to read data from the contract", async function () {
        const _orderbook = await Orderbook.new(1, ren.address, dnr.address);

        let buyOrderId;
        let sellOrderId;

        { // Open orders first
            await ren.approve(_orderbook.address, 2 * INGRESS_FEE, { from: broker });

            buyOrderId = testUtils.randomID();
            sellOrderId = testUtils.randomID();

            let prefix = web3.utils.toHex("Republic Protocol: open: ");
            let buyHash = prefix + buyOrderId.slice(2);
            let sellHash = prefix + sellOrderId.slice(2);
            let buySignature = await web3.eth.sign(buyHash, accounts[0]);
            let sellSignature = await web3.eth.sign(sellHash, accounts[0]);

            await _orderbook.openBuyOrder(buySignature, buyOrderId, { from: broker });
            await _orderbook.openSellOrder(sellSignature, sellOrderId, { from: broker });
        }

        { // should be able to retrieve orders by index
            (await _orderbook.buyOrder.call(0))
                .should.deep.equal({ 0: buyOrderId, 1: true });

            // Get order from the orderbook
            (await _orderbook.sellOrder.call(0))
                .should.deep.equal({ 0: sellOrderId, 1: true });

            // Negative test for get order
            (await _orderbook.buyOrder.call(1))
                .should.deep.equal(
                    { 0: "0x0000000000000000000000000000000000000000000000000000000000000000", 1: false }
                );

            (await _orderbook.sellOrder.call(1))
                .should.deep.equal(
                    { 0: "0x0000000000000000000000000000000000000000000000000000000000000000", 1: false }
                );

            // Get order from the orderbook
            (await _orderbook.getOrder.call(0))
                .should.deep.equal({ 0: buyOrderId, 1: true });

            // Get order from the orderbook
            (await _orderbook.getOrder.call(1))
                .should.deep.equal({ 0: sellOrderId, 1: true });

            // Get order from the orderbook
            (await _orderbook.getOrder.call(2))
                .should.deep.equal(
                    { 0: "0x0000000000000000000000000000000000000000000000000000000000000000", 1: false }
                );
        }

        await _orderbook.confirmOrder(buyOrderId, [sellOrderId], { from: darknode });
        const confirmationBlockNumber = (await web3.eth.getBlock("latest")).number;

        { // should be able to retrieve order details
            // Get order status
            (await _orderbook.orderState.call(buyOrderId)).toNumber()
                .should.equal(2);
            (await _orderbook.orderState.call(sellOrderId)).toNumber()
                .should.equal(2);

            // Get order match
            (await _orderbook.orderMatch.call(buyOrderId))
                .should.deep.equal([sellOrderId]);

            (await _orderbook.orderMatch.call(sellOrderId))
                .should.deep.equal([buyOrderId]);

            // Get matched order
            (await _orderbook.orderPriority.call(buyOrderId)).toNumber()
                .should.equal(1);

            // Get trader
            (await _orderbook.orderTrader.call(buyOrderId))
                .should.equal(accounts[0]);

            // Get broker
            (await _orderbook.orderBroker.call(buyOrderId))
                .should.equal(broker);

            // Get confirmer
            (await _orderbook.orderConfirmer.call(buyOrderId))
                .should.equal(darknode);

            // Get blocknumber
            (await _orderbook.orderBlockNumber.call(buyOrderId)).toNumber()
                .should.equal(confirmationBlockNumber);

            // Get blocknumber
            (await _orderbook.getOrdersCount.call()).toNumber()
                .should.equal(2);
        }
    });

});
