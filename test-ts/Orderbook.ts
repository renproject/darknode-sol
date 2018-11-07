import * as testUtils from "./helper/testUtils";
import { MINIMUM_BOND } from "./helper/testUtils";

import { ApprovingBrokerArtifact } from "./bindings/approving_broker";
import { BrokerVerifierContract } from "./bindings/broker_verifier";
import { DarknodeRegistryContract } from "./bindings/darknode_registry";
import { DisapprovingBrokerArtifact } from "./bindings/disapproving_broker";
import { OrderbookContract } from "./bindings/orderbook";
import { RepublicTokenContract } from "./bindings/republic_token";
import { SettlementRegistryContract } from "./bindings/settlement_registry";

import { TestHelper } from "zos";

import * as deployRepublicProtocolContracts from "../migrations/deploy";

const fixWeb3 = require("../migrations/fixWeb3");
const defaultConfig = require("../migrations/config");

const ApprovingBroker = artifacts.require("ApprovingBroker") as ApprovingBrokerArtifact;
const DisapprovingBroker = artifacts.require("DisapprovingBroker") as DisapprovingBrokerArtifact;

contract("Orderbook", (accounts: string[]) => {
    const proxyOwner = accounts[9];
    const contractOwner = accounts[8];
    const notOwner = accounts[7];

    const ACCOUNT_LOOP_LIMIT = accounts.length - 1;

    let republicToken: RepublicTokenContract;
    let darknodeRegistry: DarknodeRegistryContract;
    let orderbook: OrderbookContract;
    let settlementRegistry: SettlementRegistryContract;
    let darknode: string;

    let deployer;
    let config;

    const approvingSettlementID = 0x539;
    const disapprovingSettlementID = 0x540;
    const unregisteredSettlementID = 0x541;

    before(async () => {
        fixWeb3(web3, artifacts);
        this.app = await TestHelper({ from: proxyOwner, gasPrice: 10000000000 });
        config = { ...defaultConfig, CONTRACT_OWNER: contractOwner };
        ({ orderbook, settlementRegistry, darknodeRegistry, republicToken, deployer } =
            await deployRepublicProtocolContracts(artifacts, this.app, config));

        const approvingBroker: BrokerVerifierContract = await ApprovingBroker.new({ from: contractOwner });
        const disapprovingBroker: BrokerVerifierContract = await DisapprovingBroker.new({ from: contractOwner });

        await settlementRegistry.registerSettlement(
            approvingSettlementID,
            testUtils.NULL,
            approvingBroker.address,
            { from: contractOwner },
        );
        await settlementRegistry.registerSettlement(
            disapprovingSettlementID,
            testUtils.NULL,
            disapprovingBroker.address,
            { from: contractOwner },
        );

        // The following tests rely on accounts not being empty
        accounts.length.should.be.greaterThan(0);
        for (let i = 0; i < ACCOUNT_LOOP_LIMIT; i++) {
            await republicToken.transfer(accounts[i], MINIMUM_BOND.toFixed(), { from: contractOwner });
        }

        // Register all nodes
        darknode = accounts[8];
        await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: darknode });
        await darknodeRegistry.register(darknode, "0x00", { from: darknode });

        await darknodeRegistry.epoch({ from: contractOwner });
    });

    it("can update the darknode registry address", async () => {
        const previousDarknodeRegistry = await orderbook.darknodeRegistry();

        // [CHECK] The function validates the new darknode registry
        await orderbook.updateDarknodeRegistry(testUtils.NULL, { from: contractOwner })
            .should.be.rejectedWith(null, /revert/);

        // [ACTION] Update the darknode registry to another address
        await orderbook.updateDarknodeRegistry(orderbook.address, { from: contractOwner });
        // [CHECK] Verify the darknode registry address has been updated
        (await orderbook.darknodeRegistry()).should.equal(orderbook.address);

        // [CHECK] Only the owner can update the darknode registry
        await orderbook.updateDarknodeRegistry(previousDarknodeRegistry, { from: notOwner })
            .should.be.rejectedWith(null, /revert/); // not owner

        // [RESET] Reset the darknode registry to the previous address
        await orderbook.updateDarknodeRegistry(previousDarknodeRegistry, { from: contractOwner });
        (await orderbook.darknodeRegistry()).should.equal(previousDarknodeRegistry);
    });

    it("should be able to open orders", async () => {
        for (let i = 0; i < ACCOUNT_LOOP_LIMIT; i++) {
            await testUtils.openBuyOrder(orderbook, approvingSettlementID, accounts[i]);
            await testUtils.openSellOrder(orderbook, approvingSettlementID, accounts[i]);
        }
    });

    it("should be rejected when trying to open an order without broker signature", async () => {
        await testUtils.openBuyOrder(orderbook, disapprovingSettlementID, accounts[0])
            .should.be.rejectedWith(null, /invalid broker signature/); // erc20 transfer error
    });

    it("should be rejected when trying to open an order with an unregistered settlement", async () => {
        await testUtils.openBuyOrder(orderbook, unregisteredSettlementID, accounts[0])
            .should.be.rejectedWith(null, /settlement not registered/); // erc20 transfer error
    });

    it("should be rejected when trying to open an opened order", async () => {
        for (let i = 0; i < ACCOUNT_LOOP_LIMIT; i++) {
            const orderID = await testUtils.openBuyOrder(orderbook, approvingSettlementID, accounts[i]);
            await testUtils.openBuyOrder(orderbook, approvingSettlementID, accounts[i], orderID)
                .should.be.rejectedWith(null, /invalid order status/);

            await testUtils.openSellOrder(orderbook, approvingSettlementID, accounts[i], orderID)
                .should.be.rejectedWith(null, /invalid order status/);
        }
    });

    it("should be able to cancel orders", async () => {
        const ids = {};

        for (let i = 0; i < ACCOUNT_LOOP_LIMIT; i++) {
            const parity = i % 2;
            ids[i] = await testUtils.openOrder(orderbook, approvingSettlementID, accounts[i], parity);
        }

        for (let i = 0; i < ACCOUNT_LOOP_LIMIT; i++) {
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
        const confirmedOrder = await testUtils.openBuyOrder(orderbook, approvingSettlementID, accounts[1]);
        const match = await testUtils.openSellOrder(orderbook, approvingSettlementID, accounts[3]);
        await orderbook.confirmOrder(confirmedOrder, match, { from: darknode });

        await testUtils.cancelOrder(orderbook, accounts[1], confirmedOrder)
            .should.be.rejectedWith(null, /invalid order state/);

        await testUtils.cancelOrder(orderbook, accounts[3], match)
            .should.be.rejectedWith(null, /invalid order state/);
    });

    it("should be rejected when trying to cancel orders signed by someone else", async () => {
        const ids = {};

        for (let i = 0; i < ACCOUNT_LOOP_LIMIT; i++) {
            const parity = i % 2;
            ids[i] = await testUtils.openOrder(orderbook, approvingSettlementID, accounts[i], parity);
        }

        for (let i = 0; i < ACCOUNT_LOOP_LIMIT; i++) {
            await testUtils.cancelOrder(orderbook, accounts[(i + 1) % ACCOUNT_LOOP_LIMIT], ids[i])
                .should.be.rejectedWith(null, /not authorized/);
        }
    });

    it("should be able to confirm orders", async () => {
        const buyIDs = {};
        const sellIDs = {};

        // Open orders
        for (let i = 0; i < Math.ceil(ACCOUNT_LOOP_LIMIT / 2); i++) {
            const firstParity = i % 2;
            const secondParity = 1 - firstParity;
            const oppositeTrader = accounts[ACCOUNT_LOOP_LIMIT - 1 - i];
            buyIDs[i] = await testUtils.openOrder(orderbook, approvingSettlementID, accounts[i], firstParity);
            sellIDs[i] = await testUtils.openOrder(orderbook, approvingSettlementID, oppositeTrader, secondParity);
        }

        // Confirm orders
        for (let i = 0; i < Math.ceil(ACCOUNT_LOOP_LIMIT / 2); i++) {
            await orderbook.confirmOrder(buyIDs[i], sellIDs[i], { from: darknode });
        }
    });

    it("should be rejected when trying to confirm an non-open order", async () => {
        // Setup

        // Opened Order
        const openedOrder = await testUtils.openBuyOrder(orderbook, approvingSettlementID, accounts[0]);

        // Confirmed Order
        const confirmedOrder = await testUtils.openBuyOrder(orderbook, approvingSettlementID, accounts[1]);
        const match = await testUtils.openSellOrder(orderbook, approvingSettlementID, accounts[3]);
        await orderbook.confirmOrder(confirmedOrder, match, { from: darknode });

        // Canceled order
        const canceledOrder = await testUtils.openBuyOrder(orderbook, approvingSettlementID, accounts[1]);
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

    it("should be able to retrieve orders", async () => {
        const orderbookAlt: OrderbookContract = await deployer.deploy(
            "Orderbook",
            config.VERSION,
            darknodeRegistry.address,
            settlementRegistry.address,
            config.CONTRACT_OWNER,
        );

        const buyIds = {};
        const sellIds = {};

        for (let i = 0; i < ACCOUNT_LOOP_LIMIT; i++) {
            buyIds[i] = await testUtils.openBuyOrder(orderbookAlt, approvingSettlementID, accounts[i]);
            sellIds[i] = await testUtils.openSellOrder(orderbookAlt, approvingSettlementID, accounts[i]);
        }

        // Perform following checks for both buy and sell getters
        const checkBuysAndSells: Array<[typeof orderbookAlt.getBuyOrders, {}]> =
            [[orderbookAlt.getBuyOrders, buyIds], [orderbookAlt.getSellOrders, sellIds]];

        for (const [getOrders, ids] of checkBuysAndSells) {
            const offset = 1;
            const orders = await getOrders(offset, ACCOUNT_LOOP_LIMIT - offset);

            orders[0].length.should.equal(ACCOUNT_LOOP_LIMIT - offset);

            for (let i = 0; i < ACCOUNT_LOOP_LIMIT - offset; i++) {
                // IDs
                orders[0][i].should.equal(ids[i + offset]);
                // Traders
                orders[1][i].should.address.equal(accounts[i + offset]);
                // Status
                orders[2][i].should.bignumber.equal(1);
            }

            // Start is out of range
            const ordersOffset = await getOrders(10000, 1);
            ordersOffset[0].length.should.equal(0);

            // End is out of range
            (await getOrders(0, 10000))[0]
                .length.should.equal(ACCOUNT_LOOP_LIMIT);
        }
    });

    it("should be able to read data from the contract", async () => {
        const orderbookAlt: OrderbookContract = await deployer.deploy(
            "Orderbook",
            config.VERSION,
            darknodeRegistry.address,
            settlementRegistry.address,
            config.CONTRACT_OWNER,
        );

        const buyOrderId = await testUtils.openBuyOrder(orderbookAlt, approvingSettlementID, accounts[0]);
        const sellOrderId = await testUtils.openSellOrder(orderbookAlt, approvingSettlementID, accounts[0]);

        { // should be able to retrieve orders by index
            (await orderbookAlt.getBuyOrders(0, 1))[0]
                .should.eql([buyOrderId]);

            // Get order from the orderbook
            (await orderbookAlt.getSellOrders(0, 1))[0]
                .should.eql([sellOrderId]);

            // Negative test for get order
            const buyOrders = await orderbookAlt.getBuyOrders(1, 1);
            buyOrders[0].length.should.equal(0);
            const sellOrders = await orderbookAlt.getSellOrders(1, 1);
            sellOrders[0].length.should.equal(0);
        }

        await orderbookAlt.confirmOrder(buyOrderId, sellOrderId, { from: darknode });
        // const confirmationBlockNumber = (await web3.eth.getBlock("latest")).number;

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

            // Get trader
            (await orderbookAlt.orderTrader(buyOrderId))
                .should.address.equal(accounts[0]);

            // Get confirmer
            (await orderbookAlt.orderConfirmer(buyOrderId))
                .should.address.equal(darknode);

            // Get blocknumber
            (await orderbookAlt.ordersCount())
                .should.bignumber.equal(2);
        }
    });

});
