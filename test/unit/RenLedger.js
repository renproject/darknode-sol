const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const renLedger = artifacts.require("RenLedger");
const chai = require("chai");

var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

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
            await ren.transfer(accounts[i],10000 );
        }
        ledger = await renLedger.new(1, ren.address, dnr.address);
    });

    it('should be able to open orders', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, {from: accounts[i]});

            let orderId = await web3.utils.keccak256(i.toString());
            let prefix = await web3.utils.asciiToHex("Republic Protocol: open: ");
            let hash = await web3.utils.keccak256(prefix + orderId.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);

            await ledger.openOrder(signature, orderId, {from: accounts[i]});
        }
    });

    it('should be rejected when trying to open an opened without no REN allowance', async function () {
        for (i = 0; i < accounts.length; i++) {
            let orderId = await web3.utils.keccak256((i+100).toString());
            let prefix = await web3.utils.asciiToHex("Republic Protocol: open: ");
            let hash = await web3.utils.keccak256(prefix + orderId.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);

            await ledger.openOrder(signature, orderId, {from: accounts[i]}).should.be.rejectedWith();
        }
    });

    it('should be rejected when trying to open an opened order', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, {from: accounts[i]});

            let orderId = await web3.utils.keccak256(i.toString());
            let prefix = await web3.utils.asciiToHex("Republic Protocol: open: ");
            let hash = await web3.utils.keccak256(prefix + orderId.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);

            await ledger.openOrder(signature, orderId, {from: accounts[i]}).should.be.rejectedWith();
        }
    });

    it('should be able to cancel orders', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, {from: accounts[i]});

            let orderId = await web3.utils.keccak256(i.toString());
            let prefix = await web3.utils.asciiToHex("Republic Protocol: cancel: ");
            let hash = await web3.utils.keccak256(prefix + orderId.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);

            await ledger.cancelOrder(signature, orderId, {from: accounts[i]});
        }
    });

    it('should be rejected when trying to cancel orders which have not been open', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, {from: accounts[i]});

            let orderId = await web3.utils.keccak256((i+100).toString());
            let prefix = await web3.utils.asciiToHex("Republic Protocol: cancel: ");
            let hash = await web3.utils.keccak256(prefix + orderId.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);

            await ledger.cancelOrder(signature, orderId, {from: accounts[i]}).should.be.rejectedWith();
        }
    });

    it('should be rejected when trying to cancel orders signed by someone else', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, {from: accounts[i]});

            let orderId = await web3.utils.keccak256(((i+1 )%10).toString());
            let prefix = await web3.utils.asciiToHex("Republic Protocol: cancel: ");
            let hash = await web3.utils.keccak256(prefix + orderId.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);

            await ledger.cancelOrder(signature, orderId, {from: accounts[i]}).should.be.rejectedWith();
        }
    });

    it('should be able to confirm orders ', async function () {
        // Open a bunch of orders
        for (i = 0; i < accounts.length / 2 ; i++) {
            await ren.approve(ledger.address, 2, {from: accounts[i]});

            let orderId = await web3.utils.keccak256((i + 10).toString());
            let matchId = await web3.utils.keccak256((i + 20).toString());

            // Open a mock order
            let prefix = await web3.utils.asciiToHex("Republic Protocol: open: ");
            let hash = await web3.utils.keccak256(prefix + orderId.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);
            await ledger.openOrder(signature, orderId, {from: accounts[i]});

            // Open the matched order
            prefix = await web3.utils.asciiToHex("Republic Protocol: open: ");
            hash = await web3.utils.keccak256(prefix + matchId.slice(2));
            signature = await web3.eth.sign(hash, accounts[i]);
            await ledger.openOrder(signature, matchId, {from: accounts[i]});
        }

        // Register all nodes
        for (i = 0; i < accounts.length/ 2; i++) {
            await ren.approve(dnr.address, MINIMUM_BOND, {from: accounts[i]});
            await dnr.register(accounts[i], "", MINIMUM_BOND, {from: accounts[i]});
        }
        await dnr.epoch();

        // Confirm orders
        for (i = 0; i < accounts.length/ 2; i++) {
            let orderId = await web3.utils.keccak256((i + 10).toString()); // create a fake orderID
            let matchId = [ await web3.utils.keccak256((i + 20).toString())]; // create fake matched orderID
            let prefix = await web3.utils.asciiToHex("Republic Protocol: confirm: ");
            let hash = await web3.utils.keccak256(prefix + orderId.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);

            await ledger.confirmOrder(orderId, matchId);
        }
    });

    it('should be rejected when trying to confirmed an non-open order ', async function () {
        // Open a bunch of orders
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 2, {from: accounts[i]});
            let openedOrder  = await  web3.utils.keccak256("9")
            let confirmedOrder = await web3.utils.keccak256(i.toString());
            let nonExistOrder = await web3.utils.keccak256((i + 20).toString());

            let prefix = await web3.utils.asciiToHex("Republic Protocol: confirm: ");
            let hash = await web3.utils.keccak256(prefix + confirmedOrder.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);
            await ledger.confirmOrder(confirmedOrder, [openedOrder]).should.be.rejectedWith();
            await ledger.confirmOrder(openedOrder, [confirmedOrder]).should.be.rejectedWith();

            prefix = await web3.utils.asciiToHex("Republic Protocol: confirm: ");
            hash = await web3.utils.keccak256(prefix + nonExistOrder.slice(2));
            signature = await web3.eth.sign(hash, accounts[i]);
            await ledger.confirmOrder(nonExistOrder, [openedOrder]).should.be.rejectedWith();
            await ledger.confirmOrder(openedOrder, [nonExistOrder]).should.be.rejectedWith();
        }
    });

    it('should be rejected when an un-registered node trying to confirm orders ', async function () {
        // Since we only registered account[0-4], we'll test with acount[5-9].
        for (i = accounts.length / 2 ; i < accounts.length; i++) {
            await ren.approve(ledger.address, 2, {from: accounts[i]});
            let order1  = await  web3.utils.keccak256("7");
            let order2  = await  web3.utils.keccak256("8")

            let prefix = await web3.utils.asciiToHex("Republic Protocol: confirm: ");
            let hash = await web3.utils.keccak256(prefix + order1.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);
            await ledger.confirmOrder(order1, [order2]).should.be.rejectedWith();
            await ledger.confirmOrder(order2, [order1]).should.be.rejectedWith();
        }
    });
});

