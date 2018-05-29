const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const renLedger = artifacts.require("RenLedger");
const chai = require("chai");

chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

const MINIMUM_BOND = 100;
const MINIMUM_DARKPOOL_SIZE = 72;
const MINIMUM_EPOCH_INTERVAL = 2;

contract("RenLedger", function (accounts) {

    let ren, dnr, ledger;

    before(async function () {
        ren = await RepublicToken.new();
        dnr = await DarknodeRegistry.new(
            ren.address,
            MINIMUM_BOND,
            MINIMUM_DARKPOOL_SIZE,
            MINIMUM_EPOCH_INTERVAL
        );
        for (i = 0; i < accounts.length; i++) {
            await ren.transfer(accounts[i], 10000);
        }
        ledger = await renLedger.new(1, ren.address, dnr.address);
    });

    it('should be able to open orders', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 2 , {from: accounts[i]});

            let buyOrderId = await web3.sha3(i.toString());
            let sellOrderId = await web3.sha3((i+100).toString());


            let prefix = await web3.toHex("Republic Protocol: open: ");
            let buyHash = await web3.sha3(prefix + buyOrderId.slice(2), {encoding: 'hex'});
            let sellHash = await web3.sha3(prefix + sellOrderId.slice(2), {encoding: 'hex'});
            let buySignature = await web3.eth.sign(accounts[i], buyHash);
            let sellSignature = await web3.eth.sign(accounts[i], sellHash);

            await ledger.openBuyOrder(buySignature, buyOrderId, {from: accounts[i]});
            await ledger.openSellOrder(sellSignature, sellOrderId, {from: accounts[i]});

        }
    });

    it('should be rejected when trying to open an opened without no REN allowance', async function () {
        for (i = 0; i < accounts.length; i++) {
            let orderId = await web3.sha3((i + 100).toString());
            let prefix = await web3.toHex("Republic Protocol: open: ");
            let hash = await web3.sha3(prefix + orderId.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            await ledger.openOrder(signature, orderId, { from: accounts[i] }).should.be.rejectedWith();
        }
    });

    it('should be rejected when trying to open an opened order', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, { from: accounts[i] });

            let orderId = await web3.sha3(i.toString());
            let prefix = await web3.toHex("Republic Protocol: open: ");
            let hash = await web3.sha3(prefix + orderId.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            await ledger.openOrder(signature, orderId, { from: accounts[i] }).should.be.rejectedWith();
        }
    });

    it('should be able to cancel orders', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, { from: accounts[i] });

            let orderId = await web3.sha3(i.toString());
            let prefix = await web3.toHex("Republic Protocol: cancel: ");
            let hash = await web3.sha3(prefix + orderId.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            await ledger.cancelOrder(signature, orderId, { from: accounts[i] });
        }
    });

    it('should be rejected when trying to cancel orders which have not been open', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, { from: accounts[i] });

            let orderId = await web3.sha3((i + 100).toString());
            let prefix = await web3.toHex("Republic Protocol: cancel: ");
            let hash = await web3.sha3(prefix + orderId.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            await ledger.cancelOrder(signature, orderId, { from: accounts[i] }).should.be.rejectedWith();
        }
    });

    it('should be rejected when trying to cancel orders signed by someone else', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, { from: accounts[i] });

            let orderId = await web3.sha3(((i + 1) % 10).toString());
            let prefix = await web3.toHex("Republic Protocol: cancel: ");
            let hash = await web3.sha3(prefix + orderId.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            await ledger.cancelOrder(signature, orderId, { from: accounts[i] }).should.be.rejectedWith();
        }
    });

    it('should be able to confirm orders ', async function () {
        // Open a bunch of orders
        for (i = 0; i < accounts.length / 2; i++) {
            await ren.approve(ledger.address, 2, { from: accounts[i] });

            let orderId = await web3.sha3((i + 10).toString());
            let matchId = await web3.sha3((i + 20).toString());

            // Open a mock order
            let prefix = await web3.toHex("Republic Protocol: open: ");
            let hash = await web3.sha3(prefix + orderId.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);
            await ledger.openOrder(signature, orderId, { from: accounts[i] });

            // Open the matched order
            prefix = await web3.toHex("Republic Protocol: open: ");
            hash = await web3.sha3(prefix + matchId.slice(2), { encoding: 'hex' });
            signature = await web3.eth.sign(accounts[i], hash);
            await ledger.openOrder(signature, matchId, { from: accounts[i] });
        }

        // Register all nodes
        for (i = 0; i < accounts.length / 2; i++) {
            await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[i] });
            await dnr.register(accounts[i], "", MINIMUM_BOND, { from: accounts[i] });
        }
        await dnr.epoch();

        // Confirm orders
        for (i = 0; i < accounts.length / 2; i++) {
            let orderId = await web3.sha3((i + 10).toString()); // create a fake orderID
            let matchId = [await web3.sha3((i + 20).toString())]; // create fake matched orderID
            let prefix = await web3.toHex("Republic Protocol: confirm: ");
            let hash = await web3.sha3(prefix + orderId.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            await ledger.confirmOrder(orderId, matchId);
        }
    });

    it('should be rejected when trying to confirmed an non-open order ', async function () {
        // Open a bunch of orders
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 2, { from: accounts[i] });
            let openedOrder = await web3.sha3("9");
            let confirmedOrder = await web3.sha3(i.toString());
            let nonExistOrder = await web3.sha3((i + 20).toString());

            let prefix = await web3.toHex("Republic Protocol: confirm: ");
            let hash = await web3.sha3(prefix + confirmedOrder.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);
            await ledger.confirmOrder(confirmedOrder, [openedOrder]).should.be.rejectedWith();
            await ledger.confirmOrder(openedOrder, [confirmedOrder]).should.be.rejectedWith();

            prefix = await web3.toHex("Republic Protocol: confirm: ");
            hash = await web3.sha3(prefix + nonExistOrder.slice(2), { encoding: 'hex' });
            signature = await web3.eth.sign(accounts[i], hash);
            await ledger.confirmOrder(nonExistOrder, [openedOrder]).should.be.rejectedWith();
            await ledger.confirmOrder(openedOrder, [nonExistOrder]).should.be.rejectedWith();
        }
    });

    it('should be rejected when an un-registered node trying to confirm orders ', async function () {
        // Since we only registered account[0-4], we'll test with acount[5-9].
        for (i = accounts.length / 2; i < accounts.length; i++) {
            await ren.approve(ledger.address, 2, { from: accounts[i] });
            let order1 = await web3.sha3("7");
            let order2 = await web3.sha3("8");

            let prefix = await web3.toHex("Republic Protocol: confirm: ");
            let hash = await web3.sha3(prefix + order1.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);
            await ledger.confirmOrder(order1, [order2]).should.be.rejectedWith();
            await ledger.confirmOrder(order2, [order1]).should.be.rejectedWith();
        }
    });

    it("should be able to read data from the contract", async function () {
        // Get order from the orderbook
        let order = await ledger.order.call(0);
        let orderId = await web3.sha3("0");
        assert.equal(order[0], orderId);
        assert.equal(order[1], true);

        // Negative test for get order
        order = await ledger.order.call(100);
        assert.equal(order[0], "0x0000000000000000000000000000000000000000000000000000000000000000");
        assert.equal(order[1], false);


        // Get order status
        let status = await ledger.orderState.call(orderId);
        assert.equal(status, 3);

        // Get matched order
        let buyOrder = await web3.sha3("10");
        let sellOrder = await web3.sha3("20");
        let orderMatch = await ledger.orderMatch.call(buyOrder);
        assert.equal(orderMatch.length, 1);
        assert.equal(orderMatch[0], sellOrder);

        // Get matched order
        let priority = await ledger.orderPriority.call(orderId);
        priority.toNumber().should.equal(1);

        // Get trader
        let trader = await ledger.orderTrader.call(orderId);
        assert.equal(trader, accounts[0]);

        // Get broker
        let broker = await ledger.orderBroker.call(orderId);
        assert.equal(broker, accounts[0]);

        // Get confirmer
        let confirmer = await ledger.orderConfirmer.call(buyOrder);
        assert.equal(confirmer, accounts[0]);
    });

    it("should be able to get the depth of orderID", async function () {



        await ren.approve(ledger.address, 1, {from: accounts[1]});

        let orderId = await web3.sha3("100");

        let preDep = await ledger.orderDepth.call(orderId);
        preDep.should.be.bignumber.equal(0);

        let prefix = await web3.toHex("Republic Protocol: open: ");
        let hash = await web3.sha3(prefix + orderId.slice(2), {encoding: 'hex'});
        let signature = await web3.eth.sign(accounts[1], hash);

        await ledger.openBuyOrder(signature, orderId, {from: accounts[1]});
        let dep = await ledger.orderDepth.call(orderId);
        dep.should.be.bignumber.equal(1);
    });
});

