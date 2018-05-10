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
        ledger = await renLedger.new(ren.address, dnr.address);
    });

    it('should be able to open orders', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, {from: accounts[i]});

            let orderId = await web3.utils.sha3(i.toString()); // create a fake orderID
            let prefix = await web3.utils.asciiToHex("Republic Protocol: open: ");
            let hash = await web3.utils.sha3(prefix + orderId.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);

            await ledger.openOrder(orderId, signature, {from: accounts[i]});
        }
    });

    it('should be able to cancel orders', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, {from: accounts[i]});

            let orderId = await web3.utils.sha3(i.toString()); // create a fake orderID
            let prefix = await web3.utils.asciiToHex("Republic Protocol: cancel: ");
            let hash = await web3.utils.sha3(prefix + orderId.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);

            await ledger.cancelOrder(orderId, signature, {from: accounts[i]});
        }
    });

    it('should be able to confirm orders ', async function () {
        // Open a bunch of orders
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 2, {from: accounts[i]});

            let orderId = await web3.utils.sha3((i + 10).toString());
            let matchId = await web3.utils.sha3((i + 20).toString());

            // Open a mock order
            let prefix = await web3.utils.asciiToHex("Republic Protocol: open: ");
            let hash = await web3.utils.sha3(prefix + orderId.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);
            await ledger.openOrder(orderId, signature, {from: accounts[i]});

            // Open the matched order
            prefix = await web3.utils.asciiToHex("Republic Protocol: open: ");
            hash = await web3.utils.sha3(prefix + matchId.slice(2));
            signature = await web3.eth.sign(hash, accounts[i]);
            await ledger.openOrder(matchId, signature, {from: accounts[i]});
        }
        console.log("no error here 3");

        // Register all nodes
        for (i = 0; i < accounts.length; i++) {
            let uid = (i + 1).toString();
            await ren.approve(dnr.address, MINIMUM_BOND, {from: accounts[i]});
            console.log("no error here 4");

            await dnr.register(uid, uid, MINIMUM_BOND, {from: accounts[i]});
            console.log("no error here 5");

        }
        await dnr.epoch();
        console.log("no error here 6");

        // Confirm orders
        for (i = 0; i < accounts.length; i++) {
            let orderId = await web3.utils.sha3((i + 10).toString()); // create a fake orderID
            let matchId = [ await web3.utils.sha3((i + 20).toString())]; // create fake matched orderID
            let prefix = await web3.utils.asciiToHex("Republic Protocol: confirm: ");
            let hash = await web3.utils.sha3(prefix + orderId.slice(2));
            let signature = await web3.eth.sign(hash, accounts[i]);

            await ledger.confirmOrder(orderId, matchId);
        }
    });


});