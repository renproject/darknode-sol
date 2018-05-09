const renLedger = artifacts.require("RenLedger");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

const CHANGE = 100;

contract("RenLedger", function (accounts) {

    let ledger;

    before(async function () {
        ledger = await renLedger.new();
    });

    it('should be able to open an order', async function () {
        for (i = 1 ; i < accounts.length; i ++){
            let signature = accounts[0].sign(accounts[0].address, 'Republic Protocol: open: 123456');

            const r = '0x' + signature.slice(0, 64);
            const s = '0x' + signature.slice(64, 128);
            const v = '0x' + signature.slice(128, 130);
            const v_decimal = web3.toDecimal(v);

            await ledger.open("123456", r,s,v_decimal, { from: accounts[0] });
        }
    });
})