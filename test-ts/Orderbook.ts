import * as testUtils from "./helper/testUtils";
import { MINIMUM_BOND } from "./helper/testUtils";

import { ApprovingBrokerArtifact } from "./bindings/approving_broker";
import { BrokerVerifierContract } from "./bindings/broker_verifier";
import { DarknodeRegistryArtifact, DarknodeRegistryContract } from "./bindings/darknode_registry";
import { DisapprovingBrokerArtifact } from "./bindings/disapproving_broker";
import { OrderbookArtifact, OrderbookContract } from "./bindings/orderbook";
import { RepublicTokenArtifact, RepublicTokenContract } from "./bindings/republic_token";
import { SettlementRegistryArtifact, SettlementRegistryContract } from "./bindings/settlement_registry";

const Orderbook = artifacts.require("Orderbook") as OrderbookArtifact;
const RepublicToken = artifacts.require("RepublicToken") as RepublicTokenArtifact;
const DarknodeRegistry = artifacts.require("DarknodeRegistry") as DarknodeRegistryArtifact;
const SettlementRegistry = artifacts.require("SettlementRegistry") as SettlementRegistryArtifact;
const ApprovingBroker = artifacts.require("ApprovingBroker") as ApprovingBrokerArtifact;
const DisapprovingBroker = artifacts.require("DisapprovingBroker") as DisapprovingBrokerArtifact;

contract("Orderbook", (accounts: string[]) => {

    let ren: RepublicTokenContract;
    let dnr: DarknodeRegistryContract;
    let orderbook: OrderbookContract;
    let settlementRegistry: SettlementRegistryContract;
    let darknode: string;

    const approvingSettlementID = 0x539;
    const disapprovingSettlementID = 0x540;
    const unregisteredSettlementID = 0x541;

    before(async () => {
        ren = await RepublicToken.deployed();
        dnr = await DarknodeRegistry.deployed();
        orderbook = await Orderbook.deployed();
        settlementRegistry = await SettlementRegistry.deployed();
        const approvingBroker: BrokerVerifierContract = await ApprovingBroker.new();
        const disapprovingBroker: BrokerVerifierContract = await DisapprovingBroker.new();

        await settlementRegistry.registerSettlement(
            approvingSettlementID,
            testUtils.NULL,
            approvingBroker.address,
        );
        await settlementRegistry.registerSettlement(
            disapprovingSettlementID,
            testUtils.NULL,
            disapprovingBroker.address,
        );

        // The following tests rely on accounts not being empty
        accounts.length.should.be.greaterThan(0);
        for (const account of accounts) {
            await ren.transfer(account, MINIMUM_BOND);
        }

        // Register all nodes
        darknode = accounts[8];
        await ren.approve(dnr.address, MINIMUM_BOND, { from: darknode });
        await dnr.register(darknode, "0x00", { from: darknode });

        await dnr.epoch();
    });

    it("can update the darknode registry address", async () => {
        const previousDarknodeRegistry = await orderbook.darknodeRegistry();

        // [CHECK] The function validates the new darknode registry
        await orderbook.updateDarknodeRegistry(testUtils.NULL)
            .should.be.rejectedWith(null, /revert/);

        // [ACTION] Update the darknode registry to another address
        await orderbook.updateDarknodeRegistry(orderbook.address);
        // [CHECK] Verify the darknode registry address has been updated
        (await orderbook.darknodeRegistry()).should.equal(orderbook.address);

        // [CHECK] Only the owner can update the darknode registry
        await orderbook.updateDarknodeRegistry(previousDarknodeRegistry, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // not owner

        // [RESET] Reset the darknode registry to the previous address
        await orderbook.updateDarknodeRegistry(previousDarknodeRegistry);
        (await orderbook.darknodeRegistry()).should.equal(previousDarknodeRegistry);
    });

    it("should be able to open orders", async () => {
        for (const account of accounts) {
            await testUtils.openOrder(orderbook, approvingSettlementID, account);
            await testUtils.openOrder(orderbook, approvingSettlementID, account);
        }
    });

    it("should be rejected when trying to open an order without no REN allowance", async () => {
        await testUtils.openOrder(orderbook, disapprovingSettlementID, accounts[0])
            .should.be.rejectedWith(null, /invalid broker signature/); // erc20 transfer error
    });

    it("should be rejected when trying to open an order with an unregistered settlement", async () => {
        await testUtils.openOrder(orderbook, unregisteredSettlementID, accounts[0])
            .should.be.rejectedWith(null, /settlement not registered/); // erc20 transfer error
    });

    it("should be rejected when trying to open an opened order", async () => {
        for (const account of accounts) {
            const orderID = await testUtils.openOrder(orderbook, approvingSettlementID, account);
            await testUtils.openOrder(orderbook, approvingSettlementID, account, orderID)
                .should.be.rejectedWith(null, /invalid order status/);

            await testUtils.openOrder(orderbook, approvingSettlementID, account, orderID)
                .should.be.rejectedWith(null, /invalid order status/);
        }
    });

    it("should be able to cancel orders", async () => {
        const ids = {};

        for (let i = 0; i < accounts.length; i++) {
            ids[i] = await testUtils.openOrder(orderbook, approvingSettlementID, accounts[i]);
        }

        for (let i = 0; i < accounts.length; i++) {
            await testUtils.cancelOrder(orderbook, accounts[i], ids[i]);
        }
    });

    it("should not be able to cancel orders that are not open", async () => {

        const orderID = testUtils.randomID();
        await testUtils.cancelOrder(orderbook, accounts[0], orderID)
            .should.be.rejectedWith(null, /invalid order state/);
    });

    it("should not be able to cancel confirmed orders", async () => {

        // Confirmed Order
        const confirmedOrder = await testUtils.openOrder(orderbook, approvingSettlementID, accounts[1]);
        const match = await testUtils.openOrder(orderbook, approvingSettlementID, accounts[3]);
        await orderbook.confirmOrder(confirmedOrder, match, { from: darknode });

        await testUtils.cancelOrder(orderbook, accounts[1], confirmedOrder)
            .should.be.rejectedWith(null, /invalid order state/);

        await testUtils.cancelOrder(orderbook, accounts[3], match)
            .should.be.rejectedWith(null, /invalid order state/);
    });

    it("should be rejected when trying to cancel orders signed by someone else", async () => {
        const ids = {};

        for (let i = 0; i < accounts.length; i++) {
            ids[i] = await testUtils.openOrder(orderbook, approvingSettlementID, accounts[i]);
        }

        for (let i = 0; i < accounts.length; i++) {
            await testUtils.cancelOrder(orderbook, accounts[(i + 1) % accounts.length], ids[i])
                .should.be.rejectedWith(null, /not authorized/);
        }
    });

    it("should be able to confirm orders", async () => {
        const buyIDs = {};
        const sellIDs = {};

        // Open orders
        for (let i = 0; i < Math.ceil(accounts.length / 2); i++) {
            buyIDs[i] = await testUtils.openOrder(orderbook, approvingSettlementID, accounts[i]);
            sellIDs[i] = await testUtils.openOrder(orderbook, approvingSettlementID, accounts[accounts.length - 1 - i]);
        }

        // Confirm orders
        for (let i = 0; i < Math.ceil(accounts.length / 2); i++) {
            await orderbook.confirmOrder(buyIDs[i], sellIDs[i], { from: darknode });
        }
    });

    it("should be rejected when trying to confirm an non-open order", async () => {
        // Setup

        // Opened Order
        const openedOrder = await testUtils.openOrder(orderbook, approvingSettlementID, accounts[0]);

        // Confirmed Order
        const confirmedOrder = await testUtils.openOrder(orderbook, approvingSettlementID, accounts[1]);
        const match = await testUtils.openOrder(orderbook, approvingSettlementID, accounts[3]);
        await orderbook.confirmOrder(confirmedOrder, match, { from: darknode });

        // Canceled order
        const canceledOrder = await testUtils.openOrder(orderbook, approvingSettlementID, accounts[1]);
        await testUtils.cancelOrder(orderbook, accounts[1], canceledOrder);

        // Unopened Order
        const unopenedOrder = testUtils.randomID();

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

    it("should be rejected when an un-registered node trying to confirm orders", async () => {
        const order1 = testUtils.randomID();
        const order2 = testUtils.randomID();

        await orderbook.confirmOrder(order1, order2, { from: accounts[1] })
            .should.be.rejectedWith(null, /must be registered darknode/);
        await orderbook.confirmOrder(order2, order1, { from: accounts[1] })
            .should.be.rejectedWith(null, /must be registered darknode/);
    });

    it("should be able to get the depth of orderID", async () => {

        const orderID = testUtils.randomID();

        (await orderbook.orderDepth(orderID))
            .should.bignumber.equal(0);

        await testUtils.openOrder(orderbook, approvingSettlementID, accounts[0], orderID);

        (await orderbook.orderDepth(orderID))
            .should.bignumber.equal(1);
    });

    it("should be able to retrieve orders", async () => {
        const orderbookAlt: OrderbookContract = await Orderbook.new(
            "VERSION",
            dnr.address,
            settlementRegistry.address,
        );

        const ids = {};

        for (let i = 0; i < accounts.length; i++) {
            ids[i] = await testUtils.openOrder(orderbookAlt, approvingSettlementID, accounts[i]);
        }

        const offset = 1;
        const orders = await orderbookAlt.getOrders(offset, accounts.length - offset);

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
        (await orderbookAlt.getOrders(10000, 1))
            .should.deep.equal({ 0: [], 1: [], 2: [] });

        // End is out of range
        (await orderbookAlt.getOrders(0, 10000))[0]
            .length.should.equal(accounts.length);
    });

    it("should be able to read data from the contract", async () => {
        const orderbookAlt: OrderbookContract = await Orderbook.new(
            "VERSION",
            dnr.address,
            settlementRegistry.address,
        );

        const buyOrderId = await testUtils.openOrder(orderbookAlt, approvingSettlementID, accounts[0]);
        const sellOrderId = await testUtils.openOrder(orderbookAlt, approvingSettlementID, accounts[0]);

        { // should be able to retrieve orders by index
            (await orderbookAlt.getOrders(0, 1))[0]
                .should.eql([buyOrderId]);

            // Get order from the orderbook
            (await orderbookAlt.getOrders(1, 1))[0]
                .should.eql([sellOrderId]);

            // Negative test for get order
            (await orderbookAlt.getOrders(2, 1))
                // tslint:disable-next-line:object-literal-key-quotes
                .should.eql({ "0": [], "1": [], "2": [] });
        }

        await orderbookAlt.confirmOrder(buyOrderId, sellOrderId, { from: darknode });
        const confirmationBlockNumber = (await web3.eth.getBlock("latest")).number;

        { // should be able to retrieve order details
            // Get order status
            (await orderbookAlt.orderState(buyOrderId))
                .should.bignumber.equal(2);
            (await orderbookAlt.orderState(sellOrderId))
                .should.bignumber.equal(2);

            // Get order match
            (await orderbookAlt.orderMatch(buyOrderId))
                .should.deep.equal(sellOrderId);

            (await orderbookAlt.orderMatch(sellOrderId))
                .should.deep.equal(buyOrderId);

            // Get matched order
            (await orderbookAlt.orderPriority(buyOrderId))
                .should.bignumber.equal(1);

            // Get trader
            (await orderbookAlt.orderTrader(buyOrderId))
                .should.equal(accounts[0]);

            // Get confirmer
            (await orderbookAlt.orderConfirmer(buyOrderId))
                .should.equal(darknode);

            // Get blocknumber
            (await orderbookAlt.orderBlockNumber(buyOrderId))
                .should.bignumber.equal(confirmationBlockNumber);

            // Get blocknumber
            (await orderbookAlt.ordersCount())
                .should.bignumber.equal(2);
        }
    });

});
