const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const Orderbook = artifacts.require("Orderbook");
const chai = require("chai");

chai.use(require("chai-as-promised"));
chai.should();

const MINIMUM_BOND = 100;
const MINIMUM_DARKPOOL_SIZE = 72;
const MINIMUM_EPOCH_INTERVAL = 2;

const randomID = async () => {
    return await web3.sha3(Math.random().toString());
}

const openPrefix = web3.toHex("Republic Protocol: open: ");
const closePrefix = web3.toHex("Republic Protocol: cancel: ");


const steps = {
    openBuyOrder: async (orderbook, broker, account, orderID) => {
        if (!orderID) {
            orderID = await randomID();
        }

        let hash = await web3.sha3(openPrefix + orderID.slice(2), { encoding: 'hex' });
        let signature = await web3.eth.sign(account, hash);
        await orderbook.openBuyOrder(signature, orderID, { from: broker });

        return orderID;
    },

    openSellOrder: async (orderbook, broker, account, orderID) => {
        if (!orderID) {
            orderID = await randomID();
        }

        let hash = await web3.sha3(openPrefix + orderID.slice(2), { encoding: 'hex' });
        let signature = await web3.eth.sign(account, hash);
        await orderbook.openSellOrder(signature, orderID, { from: broker });

        return orderID;
    },

    cancelOrder: async (orderbook, broker, account, orderID) => {
        // Cancel canceled order
        hash = await web3.sha3(closePrefix + orderID.slice(2), { encoding: 'hex' });
        signature = await web3.eth.sign(account, hash);
        await orderbook.cancelOrder(signature, orderID, { from: broker });
    }
}

contract("Orderbook", function (accounts) {

    let ren, dnr, orderbook, darknode, broker;

    before(async function () {

        ren = await RepublicToken.new();
        dnr = await DarknodeRegistry.new(
            ren.address,
            MINIMUM_BOND,
            MINIMUM_DARKPOOL_SIZE,
            MINIMUM_EPOCH_INTERVAL
        );

        // The following tests rely on accounts not being empty
        accounts.length.should.be.greaterThan(0);
        for (i = 0; i < accounts.length; i++) {
            await ren.transfer(accounts[i], 10000);
        }
        orderbook = await Orderbook.new(1, ren.address, dnr.address);

        // Register all nodes
        darknode = accounts[8];
        await ren.approve(dnr.address, MINIMUM_BOND, { from: darknode });
        await dnr.register(darknode, "", MINIMUM_BOND, { from: darknode });
        await dnr.epoch();

        broker = accounts[9];
    });

    it('should be able to open orders', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(orderbook.address, 2, { from: accounts[i] });

            let buyOrderId = await randomID();
            let sellOrderId = await randomID();

            let buyHash = await web3.sha3(openPrefix + buyOrderId.slice(2), { encoding: 'hex' });
            let sellHash = await web3.sha3(openPrefix + sellOrderId.slice(2), { encoding: 'hex' });
            let buySignature = await web3.eth.sign(accounts[i], buyHash);
            let sellSignature = await web3.eth.sign(accounts[i], sellHash);

            await orderbook.openBuyOrder(buySignature, buyOrderId, { from: accounts[i] });
            await orderbook.openSellOrder(sellSignature, sellOrderId, { from: accounts[i] });

        }
    });

    it('should be rejected when trying to open an order without no REN allowance', async function () {
        for (i = 0; i < accounts.length; i++) {
            let orderID = await randomID();
            let hash = await web3.sha3(openPrefix + orderID.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            await orderbook.openBuyOrder(signature, orderID, { from: accounts[i] }).should.be.rejectedWith();
        }
    });

    it('should be rejected when trying to open an opened order', async function () {
        const orderID = await randomID();

        for (i = 0; i < accounts.length; i++) {
            await ren.approve(orderbook.address, 1, { from: accounts[i] });

            let hash = await web3.sha3(openPrefix + orderID.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            // Only the first account can open the order
            const promise = orderbook.openBuyOrder(signature, orderID, { from: accounts[i] });
            if (i > 0) {
                await promise.should.be.rejectedWith();
            } else {
                await promise;
            }
        }
    });

    it('should be able to cancel orders', async function () {
        const ids = {};

        await ren.approve(orderbook.address, accounts.length * 2, { from: broker });

        for (i = 0; i < accounts.length; i++) {
            ids[i] = await randomID();
            let hash = await web3.sha3(openPrefix + ids[i].slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            if (i % 2 === 0) {
                await orderbook.openBuyOrder(signature, ids[i], { from: broker });
            } else {
                await orderbook.openSellOrder(signature, ids[i], { from: broker });
            }
        }

        for (i = 0; i < accounts.length; i++) {
            let hash = await web3.sha3(closePrefix + ids[i].slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            await orderbook.cancelOrder(signature, ids[i], { from: broker });
        }
    });

    it('should be able to cancel orders that are not open', async function () {
        await ren.approve(orderbook.address, 1, { from: broker });

        let orderID = await randomID();
        let hash = await web3.sha3(closePrefix + orderID.slice(2), { encoding: 'hex' });
        let signature = await web3.eth.sign(accounts[0], hash);

        await orderbook.cancelOrder(signature, orderID, { from: broker });

    });

    it('should not be able to cancel confirmed orders', async function () {
        await ren.approve(orderbook.address, 5, { from: broker });

        // Confirmed Order
        let confirmedOrder = await steps.openBuyOrder(orderbook, broker, accounts[1]);
        let match = await steps.openSellOrder(orderbook, broker, accounts[3]);
        await orderbook.confirmOrder(confirmedOrder, [match], { from: darknode });

        await steps.cancelOrder(orderbook, broker, accounts[1], confirmedOrder)
            .should.be.rejected;

        await steps.cancelOrder(orderbook, broker, accounts[3], match)
            .should.be.rejected;
    });

    it('should be rejected when trying to cancel orders signed by someone else', async function () {
        const ids = {};

        for (i = 0; i < accounts.length; i++) {
            await ren.approve(orderbook.address, 1, { from: accounts[i] });
            ids[i] = await randomID();
            let hash = await web3.sha3(openPrefix + ids[i].slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            if (i % 2 === 0) {
                await orderbook.openBuyOrder(signature, ids[i], { from: accounts[i] });
            } else {
                await orderbook.openSellOrder(signature, ids[i], { from: accounts[i] });
            }
        }

        for (i = 0; i < accounts.length; i++) {
            await ren.approve(orderbook.address, 1, { from: accounts[i] });

            let hash = await web3.sha3(closePrefix + ids[(i + 1) % accounts.length].slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);
            await orderbook.cancelOrder(signature, ids[(i + 1) % accounts.length], { from: accounts[i] }).should.be.rejectedWith();
        }
    });

    it('should be able to confirm orders', async function () {
        const buyIDs = {};
        const sellIDs = {};

        // Open a bunch of orders
        for (i = 0; i < accounts.length / 2; i++) {
            await ren.approve(orderbook.address, 2, { from: accounts[i] });

            buyIDs[i] = await randomID();
            sellIDs[i] = await randomID();

            // Open a mock order
            let hash = await web3.sha3(openPrefix + buyIDs[i].slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);
            await orderbook.openBuyOrder(signature, buyIDs[i], { from: accounts[i] });

            // Open the matched order
            hash = await web3.sha3(openPrefix + sellIDs[i].slice(2), { encoding: 'hex' });
            signature = await web3.eth.sign(accounts[i], hash);
            await orderbook.openSellOrder(signature, sellIDs[i], { from: accounts[i] });
        }

        // Confirm orders
        for (i = 0; i < accounts.length / 2; i++) {
            await orderbook.confirmOrder(buyIDs[i], [sellIDs[i]], { from: darknode });
        }
    });

    it('should be rejected when trying to confirm an non-open order', async function () {
        // Setup
        await ren.approve(orderbook.address, 5, { from: broker });

        // Opened Order
        let openedOrder = await steps.openBuyOrder(orderbook, broker, accounts[0]);

        // Confirmed Order
        let confirmedOrder = await steps.openSellOrder(orderbook, broker, accounts[1]);
        let match = await steps.openBuyOrder(orderbook, broker, accounts[3]);
        await orderbook.confirmOrder(confirmedOrder, [match], { from: darknode });

        // Canceled order
        let canceledOrder = await steps.openSellOrder(orderbook, broker, accounts[1]);
        await steps.cancelOrder(orderbook, broker, accounts[1], canceledOrder);

        // Unopened Order
        let unopenedOrder = await randomID();


        await orderbook.confirmOrder(confirmedOrder, [openedOrder], { from: darknode }).should.be.rejectedWith();
        await orderbook.confirmOrder(openedOrder, [confirmedOrder], { from: darknode }).should.be.rejectedWith();

        await orderbook.confirmOrder(unopenedOrder, [openedOrder], { from: darknode }).should.be.rejectedWith();
        await orderbook.confirmOrder(openedOrder, [unopenedOrder], { from: darknode }).should.be.rejectedWith();

        await orderbook.confirmOrder(canceledOrder, [openedOrder], { from: darknode }).should.be.rejectedWith();
        await orderbook.confirmOrder(openedOrder, [canceledOrder], { from: darknode }).should.be.rejectedWith();
    });

    it('should be rejected when an un-registered node trying to confirm orders', async function () {
        await ren.approve(orderbook.address, 2, { from: accounts[i] });
        let order1 = await randomID();
        let order2 = await randomID();

        await orderbook.confirmOrder(order1, [order2], { from: accounts[1] }).should.be.rejectedWith();
        await orderbook.confirmOrder(order2, [order1], { from: accounts[1] }).should.be.rejectedWith();
    });

    it("should be able to get the depth of orderID", async function () {

        await ren.approve(orderbook.address, 1, { from: accounts[1] });

        let orderID = await randomID();

        (await orderbook.orderDepth.call(orderID))
            .toNumber().should.equal(0);

        let prefix = await web3.toHex("Republic Protocol: open: ");
        let hash = await web3.sha3(prefix + orderID.slice(2), { encoding: 'hex' });
        let signature = await web3.eth.sign(accounts[1], hash);

        await orderbook.openBuyOrder(signature, orderID, { from: accounts[1] });
        (await orderbook.orderDepth.call(orderID))
            .toNumber().should.equal(1);
    });

    it('should be able to retrieve orders', async function () {
        _orderbook = await Orderbook.new(1, ren.address, dnr.address);

        const ids = {};

        for (i = 0; i < accounts.length; i++) {
            await ren.approve(_orderbook.address, 2, { from: accounts[i] });

            ids[i] = await randomID();

            let prefix = await web3.toHex("Republic Protocol: open: ");
            let hash = await web3.sha3(prefix + ids[i].slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            if (i % 2 === 0) {
                await _orderbook.openBuyOrder(signature, ids[i], { from: accounts[i] });
            } else {
                await _orderbook.openSellOrder(signature, ids[i], { from: accounts[i] });
            }
        }

        const offset = 1;
        const orders = await _orderbook.getOrders(offset, accounts.length);

        orders[0].length.should.equal(accounts.length - offset);

        for (let i = 0; i < accounts.length - offset; i++) {
            // IDs
            orders[0][i].should.equal(ids[i + offset]);
            // Traders
            orders[1][i].should.equal(accounts[i + offset]);
            // Status
            orders[2][i].toNumber().should.equal(1);
        }

        (await _orderbook.getOrders(10000, 1))
            .should.deep.equal([[], [], []]);

        (await _orderbook.getOrders(0, 10000))[0]
            .length.should.equal(accounts.length);
    });


    it('should be able to retrieve trader from signature', async function () {
        // Last byte can be 0x1b or 0x00
        const signature = "0xe7c44ade11bc806ed80b645b2fe2d62d64b9a1bb5144a4d536f2038da9ac149c48292103db545dd11414f8bbde677e51e829a0d5f7211323ccdb51e175fe34ab1b";

        const data = "0x55dd146decc436d869bf58f1d64f557870f4ec91807af9759fc81c690d454d57";
        const id = "0x54c483844aaa986dfe61c75facc37e0851b823f18ea14bfef94f0f77bb2afa9d";

        let prefix = await web3.toHex("Republic Protocol: open: ");
        data.should.equal(await web3.sha3(prefix + id.slice(2), { encoding: 'hex' }));

        await ren.approve(orderbook.address, 1, { from: accounts[0] });
        await orderbook.openBuyOrder(signature, id, { from: accounts[0] });
        (await orderbook.orderTrader.call(id)).should.equal("0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66".toLowerCase());
    });



    it("should be able to read data from the contract", async function () {
        _orderbook = await Orderbook.new(1, ren.address, dnr.address);

        let buyOrderId;
        let sellOrderId;

        { // Open orders first
            await ren.approve(_orderbook.address, 2, { from: broker });

            buyOrderId = await randomID();
            sellOrderId = await randomID();

            let prefix = await web3.toHex("Republic Protocol: open: ");
            let buyHash = await web3.sha3(prefix + buyOrderId.slice(2), { encoding: 'hex' });
            let sellHash = await web3.sha3(prefix + sellOrderId.slice(2), { encoding: 'hex' });
            let buySignature = await web3.eth.sign(accounts[0], buyHash);
            let sellSignature = await web3.eth.sign(accounts[0], sellHash);

            await _orderbook.openBuyOrder(buySignature, buyOrderId, { from: broker });
            await _orderbook.openSellOrder(sellSignature, sellOrderId, { from: broker });
        }


        { // should be able to retrieve orders by index
            (await _orderbook.buyOrder.call(0))
                .should.deep.equal([buyOrderId, true]);

            // Get order from the orderbook
            (await _orderbook.sellOrder.call(0))
                .should.deep.equal([sellOrderId, true]);

            // Negative test for get order
            (await _orderbook.buyOrder.call(1))
                .should.deep.equal(["0x0000000000000000000000000000000000000000000000000000000000000000", false]);

            (await _orderbook.sellOrder.call(1))
                .should.deep.equal(["0x0000000000000000000000000000000000000000000000000000000000000000", false]);

            // Get order from the orderbook
            (await _orderbook.getOrder.call(0))
                .should.deep.equal([buyOrderId, true]);

            // Get order from the orderbook
            (await _orderbook.getOrder.call(1))
                .should.deep.equal([sellOrderId, true]);

            // Get order from the orderbook
            (await _orderbook.getOrder.call(2))
                .should.deep.equal(["0x0000000000000000000000000000000000000000000000000000000000000000", false]);
        }

        await _orderbook.confirmOrder(buyOrderId, [sellOrderId], { from: darknode });
        const confirmationBlockNumber = (await web3.eth.getBlock('latest')).number;

        { // should be able to retrieve order details
            // Get order status
            (await _orderbook.orderState.call(buyOrderId))
                .toNumber().should.equal(2);
            (await _orderbook.orderState.call(sellOrderId))
                .toNumber().should.equal(2);

            // Get order match
            (await _orderbook.orderMatch.call(buyOrderId))
                .should.deep.equal([sellOrderId]);

            (await _orderbook.orderMatch.call(sellOrderId))
                .should.deep.equal([buyOrderId]);

            // Get matched order
            (await _orderbook.orderPriority.call(buyOrderId))
                .toNumber().should.equal(1);

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
            (await _orderbook.orderBlockNumber.call(buyOrderId))
                .toNumber().should.equal(confirmationBlockNumber);

            // Get blocknumber
            (await _orderbook.getOrdersCount.call())
                .toNumber().should.equal(2);
        }
    });

});

