const DarkNodeRegistry = artifacts.require("DarkNodeRegistry");
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
        dnr = await DarkNodeRegistry.new(
            ren.address,
            MINIMUM_BOND,
            MINIMUM_DARKPOOL_SIZE,
            MINIMUM_EPOCH_INTERVAL
        );
        for (i = 0; i < accounts.length; i++) {
            await ren.transfer(accounts[i], MINIMUM_BOND);
        }
        ledger = await renLedger.new(ren.address, dnr.address);

    });

    it('should be able to open an order', async function () {
        for (i = 0; i < accounts.length; i++) {
            await ren.approve(ledger.address, 1, {from: accounts[i]});

            let orderId = web3.utils.sha3(i.toString()); // create a fake orderID
            let msg = web3.utils.fromAscii('Republic Protocol: open: ') + orderId;
            let hash = web3.utils.sha3(msg);
            let signature = await web3.eth.sign(hash, accounts[i]);

            const r = '0x' + signature.slice(2, 66);
            const s = '0x' + signature.slice(66, 130);
            const v = '0x' + signature.slice(130, 132);
            const v_decimal = web3.utils.hexToNumber(v) + 27;

            console.log(orderId);
            await ledger.openOrder(orderId, v_decimal, r, s, {from: accounts[i]});
        }
    });
});