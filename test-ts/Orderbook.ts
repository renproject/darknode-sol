import { RepublicTokenContract } from "./bindings/republic_token";
import { DarknodeRegistryContract } from "./bindings/darknode_registry";
import { OrderbookContract } from "./bindings/orderbook";

const Orderbook = artifacts.require("Orderbook");

import * as testUtils from "./helper/testUtils";
import { MINIMUM_BOND } from "./helper/testUtils";
import { SettlementRegistryContract } from "./bindings/settlement_registry";
import { BrokerVerifierContract } from "./bindings/broker_verifier";

contract("Orderbook", function (accounts: string[]) {

    let ren: RepublicTokenContract;
    let dnr: DarknodeRegistryContract;
    let orderbook: OrderbookContract;
    let settlementRegistry: SettlementRegistryContract;
    let darknode: string;

    const approvingBrokerID = 0x539;
    const disapprovingBrokerID = 0x540;

    before(async function () {
        ren = await artifacts.require("RepublicToken").deployed();
        dnr = await artifacts.require("DarknodeRegistry").deployed();
        orderbook = await Orderbook.deployed();
        settlementRegistry = await artifacts.require("SettlementRegistry").deployed();
        const approvingBroker: BrokerVerifierContract = await artifacts.require("ApprovingBroker").new();
        const disapprovingBroker: BrokerVerifierContract = await artifacts.require("DisapprovingBroker").new();

        await settlementRegistry.registerSettlement(approvingBrokerID, testUtils.NULL, approvingBroker.address);
        await settlementRegistry.registerSettlement(disapprovingBrokerID, testUtils.NULL, disapprovingBroker.address);

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
        for (let i = 0; i < accounts.length; i++) {
            await testUtils.openOrder(orderbook, approvingBrokerID, accounts[i]);
            await testUtils.openOrder(orderbook, approvingBrokerID, accounts[i]);
        }
    });

    it("should be rejected when trying to open an order without no REN allowance", async function () {
        await testUtils.openOrder(orderbook, disapprovingBrokerID, accounts[0])
            .should.be.rejectedWith(null, /invalid broker signature/); // erc20 transfer error
    });

    it("should be rejected when trying to open an opened order", async function () {
        for (let i = 0; i < accounts.length; i++) {

            const orderID = await testUtils.openOrder(orderbook, approvingBrokerID, accounts[0]);
            await testUtils.openOrder(orderbook, approvingBrokerID, accounts[0], orderID)
                .should.be.rejectedWith(null, /invalid order status/);

            await testUtils.openOrder(orderbook, approvingBrokerID, accounts[0], orderID)
                .should.be.rejectedWith(null, /invalid order status/);
        }
    });

    it("should be able to cancel orders", async function () {
        const ids = {};

        for (let i = 0; i < accounts.length; i++) {
            ids[i] = await testUtils.openOrder(orderbook, approvingBrokerID, accounts[i]);
        }

        for (let i = 0; i < accounts.length; i++) {
            await testUtils.cancelOrder(orderbook, accounts[i], ids[i]);
        }
    });

    it("should not be able to cancel orders that are not open", async function () {

        let orderID = testUtils.randomID();
        await testUtils.cancelOrder(orderbook, accounts[0], orderID)
            .should.be.rejectedWith(null, /invalid order state/);
    });

    it("should not be able to cancel confirmed orders", async function () {

        // Confirmed Order
        let confirmedOrder = await testUtils.openOrder(orderbook, approvingBrokerID, accounts[1]);
        let match = await testUtils.openOrder(orderbook, approvingBrokerID, accounts[3]);
        await orderbook.confirmOrder(confirmedOrder, match, { from: darknode });

        await testUtils.cancelOrder(orderbook, accounts[1], confirmedOrder)
            .should.be.rejectedWith(null, /invalid order state/);

        await testUtils.cancelOrder(orderbook, accounts[3], match)
            .should.be.rejectedWith(null, /invalid order state/);
    });

    it("should be rejected when trying to cancel orders signed by someone else", async function () {
        const ids = {};

        for (let i = 0; i < accounts.length; i++) {
            ids[i] = await testUtils.openOrder(orderbook, approvingBrokerID, accounts[i]);
        }

        for (let i = 0; i < accounts.length; i++) {
            await testUtils.cancelOrder(orderbook, accounts[(i + 1) % accounts.length], ids[i])
                .should.be.rejectedWith(null, /not authorized/);
        }
    });

    it("should be able to confirm orders", async function () {
        const buyIDs = {};
        const sellIDs = {};

        // Open orders
        for (let i = 0; i < Math.ceil(accounts.length / 2); i++) {
            buyIDs[i] = await testUtils.openOrder(orderbook, approvingBrokerID, accounts[i]);
            sellIDs[i] = await testUtils.openOrder(orderbook, approvingBrokerID, accounts[accounts.length - 1 - i]);
        }

        // Confirm orders
        for (let i = 0; i < Math.ceil(accounts.length / 2); i++) {
            await orderbook.confirmOrder(buyIDs[i], sellIDs[i], { from: darknode });
        }
    });

    it("should be rejected when trying to confirm an non-open order", async function () {
        // Setup

        // Opened Order
        let openedOrder = await testUtils.openOrder(orderbook, approvingBrokerID, accounts[0]);

        // Confirmed Order
        let confirmedOrder = await testUtils.openOrder(orderbook, approvingBrokerID, accounts[1]);
        let match = await testUtils.openOrder(orderbook, approvingBrokerID, accounts[3]);
        await orderbook.confirmOrder(confirmedOrder, match, { from: darknode });

        // Canceled order
        let canceledOrder = await testUtils.openOrder(orderbook, approvingBrokerID, accounts[1]);
        await testUtils.cancelOrder(orderbook, accounts[1], canceledOrder);

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
        let order1 = testUtils.randomID();
        let order2 = testUtils.randomID();

        await orderbook.confirmOrder(order1, order2, { from: accounts[1] })
            .should.be.rejectedWith(null, /must be registered darknode/);
        await orderbook.confirmOrder(order2, order1, { from: accounts[1] })
            .should.be.rejectedWith(null, /must be registered darknode/);
    });

    it("should be able to get the depth of orderID", async function () {

        let orderID = testUtils.randomID();

        (await orderbook.orderDepth(orderID))
            .should.bignumber.equal(0);

        await testUtils.openOrder(orderbook, approvingBrokerID, accounts[0], orderID);

        (await orderbook.orderDepth(orderID))
            .should.bignumber.equal(1);
    });

    it("should be able to retrieve orders", async function () {
        const _orderbook: OrderbookContract = await Orderbook.new(ren.address, dnr.address, settlementRegistry.address);

        const ids = {};

        for (let i = 0; i < accounts.length; i++) {
            ids[i] = await testUtils.openOrder(_orderbook, approvingBrokerID, accounts[i]);
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

        // Start is out of range
        (await _orderbook.getOrders(10000, 1))
            .should.deep.equal({ 0: [], 1: [], 2: [] });

        // End is out of range
        (await _orderbook.getOrders(0, 10000))[0]
            .length.should.equal(accounts.length);
    });

    it("should be able to read data from the contract", async function () {
        const _orderbook: OrderbookContract = await Orderbook.new(ren.address, dnr.address, settlementRegistry.address);

        const buyOrderId = await testUtils.openOrder(_orderbook, approvingBrokerID, accounts[0]);
        const sellOrderId = await testUtils.openOrder(_orderbook, approvingBrokerID, accounts[0]);

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
