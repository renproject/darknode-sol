import { RepublicTokenContract } from "./bindings/republic_token";
import { DarknodeRegistryContract } from "./bindings/darknode_registry";
import { OrderbookContract } from "./bindings/orderbook";

const Orderbook = artifacts.require("Orderbook");

import * as testUtils from "./helper/testUtils";
import { INGRESS_FEE, MINIMUM_BOND } from "./helper/testUtils";

contract("Orderbook", function (accounts: string[]) {

    let ren: RepublicTokenContract;
    let dnr: DarknodeRegistryContract;
    let orderbook: OrderbookContract;
    let darknode: string, broker: string;

    before(async function () {
        ren = await artifacts.require("RepublicToken").deployed();
        dnr = await artifacts.require("DarknodeRegistry").deployed();
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
        (await orderbook.orderOpeningFee()).should.bignumber.equal(1);
        await orderbook.updateFee(INGRESS_FEE, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // not owner
        await orderbook.updateFee(INGRESS_FEE);
        (await orderbook.orderOpeningFee()).should.bignumber.equal(INGRESS_FEE);
    });

    it("can update the darknode registry address", async () => {
        await orderbook.updateDarknodeRegistry(testUtils.NULL);
        (await orderbook.darknodeRegistry()).should.equal(testUtils.NULL);
        await orderbook.updateDarknodeRegistry(dnr.address, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // not owner
        await orderbook.updateDarknodeRegistry(dnr.address);
        (await orderbook.darknodeRegistry()).should.equal(dnr.address);
    });

    it("should be able to open orders", async function () {
        await ren.approve(orderbook.address, 2 * accounts.length * INGRESS_FEE, { from: broker });
        for (let i = 0; i < accounts.length; i++) {
            await testUtils.openOrder(orderbook, broker, accounts[i]);
            await testUtils.openOrder(orderbook, broker, accounts[i]);
        }
    });

    it("should be rejected when trying to open an order without no REN allowance", async function () {
        (INGRESS_FEE).should.be.greaterThan(0, "Can't run test if Ingress fee is 0");
        await ren.approve(orderbook.address, 0, { from: broker });
        await testUtils.openOrder(orderbook, broker, accounts[0])
            .should.be.rejectedWith(null, /revert/); // erc20 transfer error
        await testUtils.openOrder(orderbook, broker, accounts[0])
            .should.be.rejectedWith(null, /revert/); // erc20 transfer error
    });

    it("should be rejected when trying to open an opened order", async function () {
        for (let i = 0; i < accounts.length; i++) {
            await ren.approve(orderbook.address, 2 * INGRESS_FEE, { from: broker });

            const orderID = await testUtils.openOrder(orderbook, broker, accounts[0]);
            await testUtils.openOrder(orderbook, broker, accounts[0], orderID)
                .should.be.rejectedWith(null, /invalid order status/);

            await testUtils.openOrder(orderbook, broker, accounts[0], orderID)
                .should.be.rejectedWith(null, /invalid order status/);
        }
    });

    it("should be able to cancel orders", async function () {
        const ids = {};

        await ren.approve(orderbook.address, accounts.length * 2 * INGRESS_FEE, { from: broker });

        for (let i = 0; i < accounts.length; i++) {
            ids[i] = (i % 2 === 0) ?
                await testUtils.openOrder(orderbook, broker, accounts[i]) :
                await testUtils.openOrder(orderbook, broker, accounts[i]);
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
        let confirmedOrder = await testUtils.openOrder(orderbook, broker, accounts[1]);
        let match = await testUtils.openOrder(orderbook, broker, accounts[3]);
        await orderbook.confirmOrder(confirmedOrder, match, { from: darknode });

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
                await testUtils.openOrder(orderbook, broker, accounts[i]) :
                await testUtils.openOrder(orderbook, broker, accounts[i]);
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

        await ren.approve(orderbook.address, 2 * Math.ceil(accounts.length / 2) * INGRESS_FEE, { from: broker });

        // Open orders
        for (let i = 0; i < Math.ceil(accounts.length / 2); i++) {

            buyIDs[i] = await testUtils.openOrder(orderbook, broker, accounts[i]);
            sellIDs[i] = await testUtils.openOrder(orderbook, broker, accounts[accounts.length - 1 - i]);
        }

        // Confirm orders
        for (let i = 0; i < Math.ceil(accounts.length / 2); i++) {
            await orderbook.confirmOrder(buyIDs[i], sellIDs[i], { from: darknode });
        }
    });

    it("should be rejected when trying to confirm an non-open order", async function () {
        // Setup
        await ren.approve(orderbook.address, 5 * INGRESS_FEE, { from: broker });

        // Opened Order
        let openedOrder = await testUtils.openOrder(orderbook, broker, accounts[0]);

        // Confirmed Order
        let confirmedOrder = await testUtils.openOrder(orderbook, broker, accounts[1]);
        let match = await testUtils.openOrder(orderbook, broker, accounts[3]);
        await orderbook.confirmOrder(confirmedOrder, match, { from: darknode });

        // Canceled order
        let canceledOrder = await testUtils.openOrder(orderbook, broker, accounts[1]);
        await testUtils.cancelOrder(orderbook, broker, accounts[1], canceledOrder);

        // Unopened Order
        let unopenedOrder = testUtils.randomID();

        await orderbook.confirmOrder(confirmedOrder, openedOrder, { from: darknode })
            .should.be.rejectedWith(null, /invalid order status/);
        await orderbook.confirmOrder(openedOrder, confirmedOrder, { from: darknode })
            .should.be.rejectedWith(null, /invalid order status/);

        await orderbook.confirmOrder(unopenedOrder, openedOrder, { from: darknode })
            .should.be.rejectedWith(null, /invalid order status/);
        await orderbook.confirmOrder(openedOrder, unopenedOrder, { from: darknode })
            .should.be.rejectedWith(null, /invalid order status/);

        await orderbook.confirmOrder(canceledOrder, openedOrder, { from: darknode })
            .should.be.rejectedWith(null, /invalid order status/);
        await orderbook.confirmOrder(openedOrder, canceledOrder, { from: darknode })
            .should.be.rejectedWith(null, /invalid order status/);
    });

    it("should be rejected when an un-registered node trying to confirm orders", async function () {
        await ren.approve(orderbook.address, 2 * INGRESS_FEE, { from: accounts[0] });
        let order1 = testUtils.randomID();
        let order2 = testUtils.randomID();

        await orderbook.confirmOrder(order1, order2, { from: accounts[1] })
            .should.be.rejectedWith(null, /must be registered darknode/);
        await orderbook.confirmOrder(order2, order1, { from: accounts[1] })
            .should.be.rejectedWith(null, /must be registered darknode/);
    });

    it("should be able to get the depth of orderID", async function () {

        await ren.approve(orderbook.address, INGRESS_FEE, { from: broker });

        let orderID = testUtils.randomID();

        (await orderbook.orderDepth(orderID))
            .should.bignumber.equal(0);

        await testUtils.openOrder(orderbook, broker, accounts[0], orderID);

        (await orderbook.orderDepth(orderID))
            .should.bignumber.equal(1);
    });

    it("should be able to retrieve orders", async function () {
        const _orderbook = await Orderbook.new(1, ren.address, dnr.address);

        const ids = {};

        await ren.approve(_orderbook.address, 2 * accounts.length * INGRESS_FEE, { from: broker });
        for (let i = 0; i < accounts.length; i++) {
            ids[i] = (i % 2 === 0) ?
                await testUtils.openOrder(_orderbook, broker, accounts[i]) :
                await testUtils.openOrder(_orderbook, broker, accounts[i]);
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
        const account = accounts[6];
        const id = testUtils.randomID();

        const signature = await web3.eth.sign(testUtils.openPrefix + id.slice(2), account);

        await ren.approve(orderbook.address, INGRESS_FEE, { from: broker });
        await orderbook.openOrder(signature, id, { from: broker });
        (await orderbook.orderTrader(id)).should.equal(account);
    });

    it("should be able to read data from the contract", async function () {
        const _orderbook: OrderbookContract = await Orderbook.new(1, ren.address, dnr.address);

        let buyOrderId;
        let sellOrderId;

        { // Open orders first
            await ren.approve(_orderbook.address, 2 * INGRESS_FEE, { from: broker });

            buyOrderId = testUtils.randomID();
            sellOrderId = testUtils.randomID();

            let buyHash = testUtils.openPrefix + buyOrderId.slice(2);
            let sellHash = testUtils.openPrefix + sellOrderId.slice(2);
            let buySignature = await web3.eth.sign(buyHash, accounts[0]);
            let sellSignature = await web3.eth.sign(sellHash, accounts[0]);

            await _orderbook.openOrder(buySignature, buyOrderId, { from: broker });
            await _orderbook.openOrder(sellSignature, sellOrderId, { from: broker });
        }

        { // should be able to retrieve orders by index
            (await _orderbook.getOrders(0, 1))[0]
                .should.eql([buyOrderId]);

            // Get order from the orderbook
            (await _orderbook.getOrders(1, 1))[0]
                .should.eql([sellOrderId]);

            // Negative test for get order
            (await _orderbook.getOrders(2, 1))
                .should.eql({ "0": [], "1": [], "2": [] });
        }

        await _orderbook.confirmOrder(buyOrderId, sellOrderId, { from: darknode });
        const confirmationBlockNumber = (await web3.eth.getBlock("latest")).number;

        { // should be able to retrieve order details
            // Get order status
            (await _orderbook.orderState(buyOrderId))
                .should.bignumber.equal(2);
            (await _orderbook.orderState(sellOrderId))
                .should.bignumber.equal(2);

            // Get order match
            (await _orderbook.orderMatch(buyOrderId))
                .should.deep.equal(sellOrderId);

            (await _orderbook.orderMatch(sellOrderId))
                .should.deep.equal(buyOrderId);

            // Get matched order
            (await _orderbook.orderPriority(buyOrderId))
                .should.bignumber.equal(1);

            // Get trader
            (await _orderbook.orderTrader(buyOrderId))
                .should.equal(accounts[0]);

            // Get broker
            (await _orderbook.orderBroker(buyOrderId))
                .should.equal(broker);

            // Get confirmer
            (await _orderbook.orderConfirmer(buyOrderId))
                .should.equal(darknode);

            // Get blocknumber
            (await _orderbook.orderBlockNumber(buyOrderId))
                .should.bignumber.equal(confirmationBlockNumber);

            // Get blocknumber
            (await _orderbook.ordersCount())
                .should.bignumber.equal(2);
        }
    });

});
