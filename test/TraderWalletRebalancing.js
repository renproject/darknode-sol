const TraderWallet = artifacts.require("TraderWallet");
const RepublicToken = artifacts.require("RepublicToken");
const BitcoinMock = artifacts.require("BitcoinMock");

const BigNumber = require("bignumber.js");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

const web3_1 = require("web3");

contract("TraderWallet", function (accounts) {

    let wallet, ren, btc;
    const buyer = accounts[0];
    const seller = accounts[1];

    beforeEach(async function () {
        ren = await RepublicToken.new();
        btc = await BitcoinMock.new();
        wallet = await TraderWallet.new(
        );

        // web3.eth.accounts.create();
    });

    it("can rebalance", async () => {
        const price = 0.000095;
        const renDeposit = 1 / 0.000095; // REN
        const btcDeposit = renDeposit * price; // SATS

        // Give seller some tokens
        await ren.transfer(seller, renDeposit * 1e18 * 2);

        // Approve and deposit
        await btc.approve(wallet.address, btcDeposit * 1e8, { from: buyer });
        await wallet.deposit(btc.address, btcDeposit * 1e8, { from: buyer });
        await ren.approve(wallet.address, renDeposit * 1e18, { from: seller });
        await wallet.deposit(ren.address, renDeposit * 1e18, { from: seller });


        // Buying REN for BTC
        const price1 = priceToTuple(price); // Price of 1 REN in BTC
        const volume1 = volumeToTuple(btcDeposit); // Volume in BTC

        const buy = [
            123,
            price1.c,
            price1.q,
            volume1.c,
            volume1.q,
            volume1.c,
            volume1.q,
            buyer,
            ren.address,
            web3.sha3("buy"),
        ];

        const price2 = priceToTuple(price); // Price of 1 REN in BTC
        const volume2 = volumeToTuple(renDeposit); // Volume in REN
        const sell = [
            124,
            price2.c,
            price2.q,
            volume2.c,
            volume2.q,
            volume2.c,
            volume2.q,
            seller,
            btc.address,
            web3.sha3("sell"),
        ];

        await wallet.submitOrder(...buy);
        await wallet.submitOrder(...sell);

        console.log(`Seller has ${((await wallet.getBalance(seller, ren.address)) * 1e-18).toString()} REN, ${((await wallet.getBalance(seller, btc.address)) * 1e-8).toString()} BTC`);
        console.log(`Buyer has ${((await wallet.getBalance(buyer, ren.address)) * 1e-18).toString()} REN, ${((await wallet.getBalance(buyer, btc.address)) * 1e-8).toString()} BTC`);

        await wallet.submitMatch(buy[0], sell[0]);

        console.log(`Seller has ${((await wallet.getBalance(seller, ren.address)) * 1e-18).toString()} REN, ${((await wallet.getBalance(seller, btc.address)) * 1e-8).toString()} BTC`);
        console.log(`Buyer has ${((await wallet.getBalance(buyer, ren.address)) * 1e-18).toString()} REN, ${((await wallet.getBalance(buyer, btc.address)) * 1e-8).toString()} BTC`);

        // (1).should.equal(0);
    })

});


async function getFee(txP) {
    const tx = await txP;
    const gasAmount = tx.receipt.gasUsed;
    const gasPrice = await web3.eth.getTransaction(tx.tx).gasPrice;
    return gasPrice.mul(gasAmount);
}



/**
 * Calculate price tuple from a decimal string
 * 
 * https://github.com/republicprotocol/republic-go/blob/smpc/docs/orders-and-order-fragments.md
 * 
 */
function priceToTuple(priceI) {
    const price = new BigNumber(priceI);
    const shift = 10 ** 12;
    const exponentOffset = 26;
    const step = 0.005;
    const tuple = floatToTuple(shift, exponentOffset, step, price);
    console.assert(1 <= tuple.c && tuple.c <= 1999, `Expected c (${tuple.c}) to be in [1,1999] in priceToTuple(${price})`);
    console.assert(0 <= tuple.q && tuple.q <= 52, `Expected c (${tuple.c}) to be in [0,52] in priceToTuple(${price})`);
    return tuple;
}

const getPriceStep = (price) => {
    return getStep(price, 0.005);
}

const tupleToPrice = (t) => {
    const e = new BigNumber(10).pow(t.q - 26 - 12 - 3);
    return new BigNumber(t.c).times(5).times(e);
}

const normalizePrice = (p) => {
    return tupleToPrice(priceToTuple(p));
}


function volumeToTuple(volumeI) {
    const volume = new BigNumber(volumeI);
    const shift = 10 ** 12;
    const exponentOffset = 0;
    const step = 0.2;
    const tuple = floatToTuple(shift, exponentOffset, step, volume);
    console.assert(1 <= tuple.c && tuple.c <= 49, `Expected c (${tuple.c}) to be in [1,49] in volumeToTuple(${volume})`);
    console.assert(0 <= tuple.q && tuple.q <= 52, `Expected c (${tuple.c}) to be in [0,52] in volumeToTuple(${volume})`);
    return tuple;
}


const getVolumeStep = (volume) => {
    return getStep(volume, 0.2);
}

const tupleToVolume = (t) => {
    const e = new BigNumber(10).pow(t.q - 12);
    return new BigNumber(t.c).times(0.2).times(e);
}

const normalizeVolume = (v) => {
    return tupleToVolume(volumeToTuple(v));
}


function floatToTuple(shift, exponentOffset, step, value) {
    const shifted = value.times(shift);

    const digits = -Math.floor(Math.log10(step)) + 1;
    const stepInt = step * 10 ** (digits - 1);

    // CALCULATE tuple
    let [c, exp] = significantDigits(shifted.toNumber(), digits, false);
    c = (c - (c % stepInt)) / step;

    // Simplify again if possible - e.g. [1910,32] becomes [191,33]
    let expAdd;
    [c, expAdd] = significantDigits(c, digits, true);
    exp += expAdd;

    const q = exponentOffset + exp;

    return { c, q };
}


function significantDigits(n, digits, simplify = false) {
    if (n === 0) {
        return [0, 0];
    }
    let exp = Math.floor(Math.log10(n)) - (digits - 1);
    let c = Math.floor((n) / (10 ** exp));

    if (simplify) {
        while (c % 10 === 0 && c !== 0) {
            c = c / 10;
            exp++;
        }
    }

    return [c, exp];
}

