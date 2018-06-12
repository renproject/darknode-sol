const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const renLedger = artifacts.require("RenLedger");
const chai = require("chai");
const BigNumber = require("bignumber.js");

chai.use(require("chai-as-promised"));
chai.should();

const MINIMUM_BOND = 100;
const MINIMUM_DARKPOOL_SIZE = 72;
const MINIMUM_EPOCH_INTERVAL = 2;

const randomID = async () => {
    return await web3.sha3(Math.random().toString());
}

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

        // The following tests rely on accounts not being empty
        accounts.length.should.be.greaterThan(0);
        for (i = 0; i < accounts.length; i++) {
            await ren.transfer(accounts[i], 10000);
        }
        ledger = await renLedger.new(1, ren.address, dnr.address);
    });

    it('should be able to open orders', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 2, { from: accounts[i] });

            let buyOrderId = await randomID();
            let sellOrderId = await randomID();

            let prefix = await web3.toHex("Republic Protocol: open: ");
            let buyHash = await web3.sha3(prefix + buyOrderId.slice(2), { encoding: 'hex' });
            let sellHash = await web3.sha3(prefix + sellOrderId.slice(2), { encoding: 'hex' });
            let buySignature = await web3.eth.sign(accounts[i], buyHash);
            let sellSignature = await web3.eth.sign(accounts[i], sellHash);

            await ledger.openBuyOrder(buySignature, buyOrderId, { from: accounts[i] });
            await ledger.openSellOrder(sellSignature, sellOrderId, { from: accounts[i] });

        }
    });

    it('should be rejected when trying to open an order without no REN allowance', async function () {
        for (i = 0; i < accounts.length; i++) {
            let orderID = await randomID();
            let prefix = await web3.toHex("Republic Protocol: open: ");
            let hash = await web3.sha3(prefix + orderID.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            await ledger.openBuyOrder(signature, orderID, { from: accounts[i] }).should.be.rejectedWith();
        }
    });

    it('should be rejected when trying to open an opened order', async function () {
        const orderID = await randomID();

        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, { from: accounts[i] });

            let prefix = await web3.toHex("Republic Protocol: open: ");
            let hash = await web3.sha3(prefix + orderID.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            // Only the first account can open the order
            const promise = ledger.openBuyOrder(signature, orderID, { from: accounts[i] });
            if (i > 0) {
                await promise.should.be.rejectedWith();
            } else {
                await promise;
            }
        }
    });

    it('should be able to cancel orders', async function () {
        const ids = {};

        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, { from: accounts[i] });

            ids[i] = await randomID();
            let prefix = await web3.toHex("Republic Protocol: open: ");
            let hash = await web3.sha3(prefix + ids[i].slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            if (i % 2 === 0) {
                await ledger.openBuyOrder(signature, ids[i], { from: accounts[i] });
            } else {
                await ledger.openSellOrder(signature, ids[i], { from: accounts[i] });
            }
        }

        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, { from: accounts[i] });

            let prefix = await web3.toHex("Republic Protocol: cancel: ");
            let hash = await web3.sha3(prefix + ids[i].slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            await ledger.cancelOrder(signature, ids[i], { from: accounts[i] });
        }
    });

    // TODO: Test that confirmed / canceled orders can't be cancelled
    it('should be able to cancel orders that are not open', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, { from: accounts[i] });

            let orderID = await randomID();
            let prefix = await web3.toHex("Republic Protocol: cancel: ");
            let hash = await web3.sha3(prefix + orderID.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            await ledger.cancelOrder(signature, orderID, { from: accounts[i] });
        }
    });

    it('should be rejected when trying to cancel orders signed by someone else', async function () {
        const ids = {};

        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, { from: accounts[i] });
            ids[i] = await randomID();
            let prefix = await web3.toHex("Republic Protocol: open: ");
            let hash = await web3.sha3(prefix + ids[i].slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            if (i % 2 === 0) {
                await ledger.openBuyOrder(signature, ids[i], { from: accounts[i] });
            } else {
                await ledger.openSellOrder(signature, ids[i], { from: accounts[i] });
            }
        }

        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, { from: accounts[i] });

            let prefix = await web3.toHex("Republic Protocol: cancel: ");
            let hash = await web3.sha3(prefix + ids[(i + 1) % accounts.length].slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);

            await ledger.cancelOrder(signature, ids[(i + 1) % accounts.length], { from: accounts[i] }).should.be.rejectedWith();
        }
    });

    it('should be able to confirm orders ', async function () {
        const buyIDs = {};
        const sellIDs = {};

        // Open a bunch of orders
        for (i = 0; i < accounts.length / 2; i++) {
            await ren.approve(ledger.address, 2, { from: accounts[i] });

            buyIDs[i] = await randomID();
            sellIDs[i] = await randomID();

            // Open a mock order
            let prefix = await web3.toHex("Republic Protocol: open: ");
            let hash = await web3.sha3(prefix + buyIDs[i].slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);
            await ledger.openBuyOrder(signature, buyIDs[i], { from: accounts[i] });

            // Open the matched order
            prefix = await web3.toHex("Republic Protocol: open: ");
            hash = await web3.sha3(prefix + sellIDs[i].slice(2), { encoding: 'hex' });
            signature = await web3.eth.sign(accounts[i], hash);
            await ledger.openSellOrder(signature, sellIDs[i], { from: accounts[i] });
        }

        // Register all nodes
        for (i = 0; i < accounts.length / 2; i++) {
            await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[i] });
            await dnr.register(accounts[i], "", MINIMUM_BOND, { from: accounts[i] });
        }
        await dnr.epoch();

        // Confirm orders
        for (i = 0; i < accounts.length / 2; i++) {
            await ledger.confirmOrder(buyIDs[i], [sellIDs[i]]);
        }
    });

    it('should be rejected when trying to confirm an non-open order ', async function () {
        // Open a bunch of orders
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 2, { from: accounts[i] });
            let openedOrder = await randomID();
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
            let order1 = await randomID();
            let order2 = await randomID();

            let prefix = await web3.toHex("Republic Protocol: confirm: ");
            let hash = await web3.sha3(prefix + order1.slice(2), { encoding: 'hex' });
            let signature = await web3.eth.sign(accounts[i], hash);
            await ledger.confirmOrder(order1, [order2]).should.be.rejectedWith();
            await ledger.confirmOrder(order2, [order1]).should.be.rejectedWith();
        }
    });

    // it("should be able to read data from the contract", async function () {
    //     // Get order from the orderbook
    //     let order = await ledger.buyOrder.call(0);
    //     let orderID = await web3.sha3("0");
    //     assert.equal(order[0], orderID);
    //     assert.equal(order[1], true);

    //     // Get order from the orderbook
    //     order = await ledger.sellOrder.call(0);
    //     orderID = await web3.sha3("100");
    //     assert.equal(order[0], orderID);
    //     assert.equal(order[1], true);

    //     // Negative test for get order
    //     order = await ledger.buyOrder.call(1000);
    //     assert.equal(order[0], "0x0000000000000000000000000000000000000000000000000000000000000000");
    //     assert.equal(order[1], false);


    //     // Get order status
    //     orderID = await web3.sha3("0");
    //     let status = await ledger.orderState.call(orderID);
    //     assert.equal(status, 3);

    //     // Get matched order
    //     let buyOrder = await web3.sha3("10");
    //     let sellOrder = await web3.sha3("20");
    //     let orderMatch = await ledger.orderMatch.call(buyOrder);
    //     assert.equal(orderMatch.length, 1);
    //     assert.equal(orderMatch[0], sellOrder);

    //     // Get matched order
    //     let priority = await ledger.orderPriority.call(orderID);
    //     priority.toNumber().should.equal(1);

    //     // Get trader
    //     let trader = await ledger.orderTrader.call(orderID);
    //     assert.equal(trader, accounts[0]);

    //     // Get broker
    //     let broker = await ledger.orderBroker.call(orderID);
    //     assert.equal(broker, accounts[0]);

    //     // Get confirmer
    //     let confirmer = await ledger.orderConfirmer.call(buyOrder);
    //     assert.equal(confirmer, accounts[0]);
    // });

    // it("should be able to get the depth of orderID", async function () {

    //     await ren.approve(ledger.address, 1, { from: accounts[1] });

    //     let orderID = await web3.sha3("100");

    //     let preDep = await ledger.orderDepth.call(orderID);
    //     preDep.toNumber().should.equal(0);

    //     let prefix = await web3.toHex("Republic Protocol: open: ");
    //     let hash = await web3.sha3(prefix + orderID.slice(2), { encoding: 'hex' });
    //     let signature = await web3.eth.sign(accounts[1], hash);

    //     await ledger.openBuyOrder(signature, orderID, { from: accounts[1] });
    //     let dep = await ledger.orderDepth.call(orderID);
    //     dep.toNumber().should.equal(1);
    // });


    it('should be able to retrieve trader from signature', async function () {
        // Last byte can be 0x1b or 0x00
        const signature = "0xe7c44ade11bc806ed80b645b2fe2d62d64b9a1bb5144a4d536f2038da9ac149c48292103db545dd11414f8bbde677e51e829a0d5f7211323ccdb51e175fe34ab1b";

        const data = "0x55dd146decc436d869bf58f1d64f557870f4ec91807af9759fc81c690d454d57";
        const id = "0x54c483844aaa986dfe61c75facc37e0851b823f18ea14bfef94f0f77bb2afa9d";

        let prefix = await web3.toHex("Republic Protocol: open: ");
        data.should.equal(await web3.sha3(prefix + id.slice(2), { encoding: 'hex' }));

        await ren.approve(ledger.address, 1, { from: accounts[0] });
        await ledger.openBuyOrder(signature, id, { from: accounts[0] });
        (await ledger.orderTrader.call(id)).should.equal("0x797522Fb74d42bB9fbF6b76dEa24D01A538d5D66".toLowerCase());
    });
});

