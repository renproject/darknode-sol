const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const Orderbook = artifacts.require("Orderbook");
const chai = require("chai");

chai.use(require("chai-as-promised"));
chai.should();

const MINIMUM_BOND = 100;
const MINIMUM_POD_SIZE = 72;
const MINIMUM_EPOCH_INTERVAL = 2;

const FEE = 1;

const randomID = async () => {
    return await web3.utils.sha3(Math.random().toString());
}

const openPrefix = web3.utils.toHex("Republic Protocol: open: ");
const closePrefix = web3.utils.toHex("Republic Protocol: cancel: ");


const steps = {
    openBuyOrder: async (orderbook, broker, account, orderID) => {
        if (!orderID) {
            orderID = await randomID();
        }

        let hash = await web3.utils.sha3(openPrefix + orderID.slice(2), { encoding: 'hex' });
        let signature = await web3.eth.sign(hash, account);
        await orderbook.openBuyOrder(signature, orderID, { from: broker });

        return orderID;
    },

    openSellOrder: async (orderbook, broker, account, orderID) => {
        if (!orderID) {
            orderID = await randomID();
        }

        let hash = await web3.utils.sha3(openPrefix + orderID.slice(2), { encoding: 'hex' });
        let signature = await web3.eth.sign(hash, account);
        await orderbook.openSellOrder(signature, orderID, { from: broker });

        return orderID;
    },

    cancelOrder: async (orderbook, broker, account, orderID) => {
        // Cancel canceled order
        hash = await web3.utils.sha3(closePrefix + orderID.slice(2), { encoding: 'hex' });
        signature = await web3.eth.sign(hash, account);
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
            MINIMUM_POD_SIZE,
            MINIMUM_EPOCH_INTERVAL
        );

        // The following tests rely on accounts not being empty
        accounts.length.should.be.greaterThan(0);
        for (i = 0; i < accounts.length; i++) {
            await ren.transfer(accounts[i], 10000);
        }
        orderbook = await Orderbook.new(FEE, ren.address, dnr.address);

        // Register all nodes
        darknode = accounts[8];
        await ren.approve(dnr.address, MINIMUM_BOND, { from: darknode });
        await dnr.register(darknode, "0x00", MINIMUM_BOND, { from: darknode });
        await dnr.epoch();

        broker = accounts[9];
    });

    it("can update the fee", async () => {
        await orderbook.updateFee(0x1);
        (await orderbook.fee()).should.equal("1");
        await orderbook.updateFee(FEE, { from: accounts[1] })
            .should.be.rejected;
        await orderbook.updateFee(FEE);
        (await orderbook.fee()).should.equal(FEE.toString());
    });

    it("can update the darknode registry address", async () => {
        await orderbook.updateDarknodeRegistry(0x0);
        (await orderbook.darknodeRegistry()).should.equal("0x0000000000000000000000000000000000000000");
        await orderbook.updateDarknodeRegistry(dnr.address, { from: accounts[1] })
            .should.be.rejected;
        await orderbook.updateDarknodeRegistry(dnr.address);
        (await orderbook.darknodeRegistry()).should.equal(dnr.address);
    });

    it('should be able to open orders', async function () {
        await ren.approve(orderbook.address, 2 * accounts.length, { from: broker });
        for (i = 0; i < accounts.length; i++) {
            await steps.openBuyOrder(orderbook, broker, accounts[i]);
            await steps.openSellOrder(orderbook, broker, accounts[i]);
        }
    });

    it('should be rejected when trying to open an order without no REN allowance', async function () {
        await ren.approve(orderbook.address, 0, { from: broker });
        await steps.openBuyOrder(orderbook, broker, accounts[0]).should.be.rejected;
        await steps.openSellOrder(orderbook, broker, accounts[0]).should.be.rejected;
    });

    it('should be rejected when trying to open an opened order', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(orderbook.address, 2, { from: broker });

            const orderID = await steps.openBuyOrder(orderbook, broker, accounts[0])
            await steps.openBuyOrder(orderbook, broker, accounts[0], orderID)
                .should.be.rejected;

            await steps.openSellOrder(orderbook, broker, accounts[0], orderID)
                .should.be.rejected;
        }
    });

    it('should be able to cancel orders', async function () {
        const ids = {};

        await ren.approve(orderbook.address, accounts.length * 2, { from: broker });

        for (i = 0; i < accounts.length; i++) {
            ids[i] = (i % 2 === 0) ?
                await steps.openBuyOrder(orderbook, broker, accounts[i]) :
                await steps.openSellOrder(orderbook, broker, accounts[i]);
        }

        for (i = 0; i < accounts.length; i++) {
            await steps.cancelOrder(orderbook, broker, accounts[i], ids[i]);
        }
    });

    it('should be able to cancel orders that are not open', async function () {
        await ren.approve(orderbook.address, 1, { from: broker });

        let orderID = await randomID();
        await steps.cancelOrder(orderbook, broker, accounts[0], orderID);
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

        await ren.approve(orderbook.address, accounts.length, { from: broker });

        for (i = 0; i < accounts.length; i++) {
            ids[i] = (i % 2 === 0) ?
                await steps.openBuyOrder(orderbook, broker, accounts[i]) :
                await steps.openSellOrder(orderbook, broker, accounts[i]);
        }

        for (i = 0; i < accounts.length; i++) {
            await ren.approve(orderbook.address, 1, { from: accounts[i] });
            await steps.cancelOrder(orderbook, broker, accounts[(i + 1) % accounts.length], ids[i]).should.be.rejected;
        }
    });

    it('should be able to confirm orders', async function () {
        const buyIDs = {};
        const sellIDs = {};

        await ren.approve(orderbook.address, 2 * (accounts.length / 2), { from: broker });

        // Open orders
        for (i = 0; i < accounts.length / 2; i++) {

            buyIDs[i] = await steps.openBuyOrder(orderbook, broker, accounts[i]);
            sellIDs[i] = await steps.openSellOrder(orderbook, broker, accounts[accounts.length - 1 - i]);
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


        await orderbook.confirmOrder(confirmedOrder, [openedOrder], { from: darknode }).should.be.rejected;
        await orderbook.confirmOrder(openedOrder, [confirmedOrder], { from: darknode }).should.be.rejected;

        await orderbook.confirmOrder(unopenedOrder, [openedOrder], { from: darknode }).should.be.rejected;
        await orderbook.confirmOrder(openedOrder, [unopenedOrder], { from: darknode }).should.be.rejected;

        await orderbook.confirmOrder(canceledOrder, [openedOrder], { from: darknode }).should.be.rejected;
        await orderbook.confirmOrder(openedOrder, [canceledOrder], { from: darknode }).should.be.rejected;
    });

    it('should be rejected when an un-registered node trying to confirm orders', async function () {
        await ren.approve(orderbook.address, 2, { from: accounts[i] });
        let order1 = await randomID();
        let order2 = await randomID();

        await orderbook.confirmOrder(order1, [order2], { from: accounts[1] }).should.be.rejected;
        await orderbook.confirmOrder(order2, [order1], { from: accounts[1] }).should.be.rejected;
    });

    it("should be able to get the depth of orderID", async function () {

        await ren.approve(orderbook.address, 1, { from: broker });

        let orderID = await randomID();

        (await orderbook.orderDepth.call(orderID))
            .should.equal("0");

        await steps.openBuyOrder(orderbook, broker, accounts[0], orderID);

        (await orderbook.orderDepth.call(orderID))
            .should.equal("1");
    });

    it('should be able to retrieve orders', async function () {
        _orderbook = await Orderbook.new(1, ren.address, dnr.address);

        const ids = {};


        await ren.approve(_orderbook.address, 2 * accounts.length, { from: broker });
        for (i = 0; i < accounts.length; i++) {
            ids[i] = (i % 2 === 0) ?
                await steps.openBuyOrder(_orderbook, broker, accounts[i]) :
                await steps.openSellOrder(_orderbook, broker, accounts[i]);
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
            orders[2][i].should.equal("1");
        }

        (await _orderbook.getOrders(10000, 1))
            .should.deep.equal({ 0: [], 1: [], 2: [] });

        (await _orderbook.getOrders(0, 10000))[0]
            .length.should.equal(accounts.length);
    });


    it('should be able to retrieve trader from signature', async function () {
        // Last byte can be 0x1b or 0x00
        const signature = "0xe7c44ade11bc806ed80b645b2fe2d62d64b9a1bb5144a4d536f2038da9ac149c48292103db545dd11414f8bbde677e51e829a0d5f7211323ccdb51e175fe34ab1b";

        const data = "0x55dd146decc436d869bf58f1d64f557870f4ec91807af9759fc81c690d454d57";
        const id = "0x54c483844aaa986dfe61c75facc37e0851b823f18ea14bfef94f0f77bb2afa9d";

        let prefix = await web3.utils.toHex("Republic Protocol: open: ");
        data.should.equal(await web3.utils.sha3(prefix + id.slice(2), { encoding: 'hex' }));

        await ren.approve(orderbook.address, 1, { from: accounts[0] });
        await orderbook.openBuyOrder(signature, id, { from: accounts[0] });
        (await orderbook.orderTrader.call(id)).should.equal("0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66");
    });



    it("should be able to read data from the contract", async function () {
        _orderbook = await Orderbook.new(1, ren.address, dnr.address);

        let buyOrderId;
        let sellOrderId;

        { // Open orders first
            await ren.approve(_orderbook.address, 2, { from: broker });

            buyOrderId = await randomID();
            sellOrderId = await randomID();

            let prefix = await web3.utils.toHex("Republic Protocol: open: ");
            let buyHash = await web3.utils.sha3(prefix + buyOrderId.slice(2), { encoding: 'hex' });
            let sellHash = await web3.utils.sha3(prefix + sellOrderId.slice(2), { encoding: 'hex' });
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
                .should.deep.equal({ 0: "0x0000000000000000000000000000000000000000000000000000000000000000", 1: false });

            (await _orderbook.sellOrder.call(1))
                .should.deep.equal({ 0: "0x0000000000000000000000000000000000000000000000000000000000000000", 1: false });

            // Get order from the orderbook
            (await _orderbook.getOrder.call(0))
                .should.deep.equal({ 0: buyOrderId, 1: true });

            // Get order from the orderbook
            (await _orderbook.getOrder.call(1))
                .should.deep.equal({ 0: sellOrderId, 1: true });

            // Get order from the orderbook
            (await _orderbook.getOrder.call(2))
                .should.deep.equal({ 0: "0x0000000000000000000000000000000000000000000000000000000000000000", 1: false });
        }

        await _orderbook.confirmOrder(buyOrderId, [sellOrderId], { from: darknode });
        const confirmationBlockNumber = (await web3.eth.getBlock('latest')).number;

        { // should be able to retrieve order details
            // Get order status
            (await _orderbook.orderState.call(buyOrderId))
                .should.equal("2");
            (await _orderbook.orderState.call(sellOrderId))
                .should.equal("2");

            // Get order match
            (await _orderbook.orderMatch.call(buyOrderId))
                .should.deep.equal([sellOrderId]);

            (await _orderbook.orderMatch.call(sellOrderId))
                .should.deep.equal([buyOrderId]);

            // Get matched order
            (await _orderbook.orderPriority.call(buyOrderId))
                .should.equal("1");

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
                .should.equal(confirmationBlockNumber.toString());

            // Get blocknumber
            (await _orderbook.getOrdersCount.call())
                .should.equal("2");
        }
    });

});

