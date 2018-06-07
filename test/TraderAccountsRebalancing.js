const TraderAccounts = artifacts.require("TraderAccounts");
const RenLedger = artifacts.require("RenLedger");
const RepublicToken = artifacts.require("RepublicToken");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const BitcoinMock = artifacts.require("BitcoinMock");
const DGXMock = artifacts.require("DGXMock");

const BigNumber = require("bignumber.js");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.should();

const OrderParity = {
    BUY: 0,
    SELL: 1,
};
let prefix = web3.toHex("Republic Protocol: open: ");

contract.only("TraderAccounts", function (accounts) {

    const buyer = accounts[0];
    const seller = accounts[1];
    const darknode = accounts[2];

    const ETH = 1;
    const BTC = 0;
    const DGX = 0x100;
    const REN = 0x10000;
    let wallet, tokenAddresses;

    before(async function () {
        tokenAddresses = {
            [ETH]: { address: 0x0 },
            [BTC]: await BitcoinMock.new(),
            [DGX]: await DGXMock.new(),
            [REN]: await RepublicToken.new(),
        }

        dnr = await DarknodeRegistry.new(
            tokenAddresses[REN].address,
            0,
            1,
            0
        );
        renLedger = await RenLedger.new(0, tokenAddresses[REN].address, dnr.address);
        wallet = await TraderAccounts.new(renLedger.address);

        await wallet.registerToken(ETH, 0x0, 18);
        await wallet.registerToken(BTC, tokenAddresses[BTC].address, (await tokenAddresses[BTC].decimals()));
        await wallet.registerToken(DGX, tokenAddresses[DGX].address, (await tokenAddresses[DGX].decimals()));
        await wallet.registerToken(REN, tokenAddresses[REN].address, (await tokenAddresses[REN].decimals()));

        // Register darknode
        await dnr.register(darknode, "", 0, { from: darknode });
        await dnr.epoch();
    });

    it("can rebalance", async () => {
        const buyPrice = 1;
        const sellPrice = 1;
        const renDeposit = 1; // REN
        const dgxDeposit = 2; // ETH

        // Give seller some tokens
        await tokenAddresses[REN].transfer(seller, renDeposit * 1e18);

        // Approve and deposit
        // await tokenAddresses[ETH].approve(wallet.address, dgxDeposit * 1e18, { from: buyer });
        await wallet.deposit(ETH, dgxDeposit * 1e18, { from: buyer, value: dgxDeposit * 1e18 });
        await tokenAddresses[REN].approve(wallet.address, renDeposit * 1e18, { from: seller });
        await wallet.deposit(REN, renDeposit * 1e18, { from: seller });

        // Overflows if ETH isn't 0
        const ETHREN = 0x100010000;


        // Buying REN for ETH
        const buyPriceT = priceToTuple(buyPrice); // Price of 1 REN in ETH
        const buyVolume = volumeToTuple(dgxDeposit); // Volume in ETH
        let buyOrderId = await web3.sha3("BUY");
        let buyHash = await web3.sha3(prefix + buyOrderId.slice(2), { encoding: 'hex' });
        const buy = [
            buyOrderId, // id
            0, // type
            OrderParity.BUY, // parity
            1641026487, // FIXME: expiry
            ETHREN, // tokens
            buyPriceT.c,
            buyPriceT.q,
            buyVolume.c,
            buyVolume.q,
            buyVolume.c,
            buyVolume.q,
            web3.sha3(8888),
        ];
        const buySignature = await web3.eth.sign(buyer, buyHash);


        const sellPriceT = priceToTuple(sellPrice); // Price of 1 REN in ETH
        const sellVolume = volumeToTuple(renDeposit); // Volume in REN
        let sellOrderId = await web3.sha3("SELL");
        let sellHash = await web3.sha3(prefix + sellOrderId.slice(2), { encoding: 'hex' });
        const sell = [
            sellOrderId, // id
            0, // type
            OrderParity.SELL, // parity
            1641026487, // FIXME: expiry
            ETHREN, // tokens
            sellPriceT.c,
            sellPriceT.q,
            sellVolume.c,
            sellVolume.q,
            sellVolume.c,
            sellVolume.q,
            web3.sha3(1337),
        ];
        const sellSignature = await web3.eth.sign(seller, sellHash);


        await renLedger.openBuyOrder(buySignature, buyOrderId, { from: buyer });
        await renLedger.openSellOrder(sellSignature, sellOrderId, { from: seller });

        (await renLedger.orderTrader(buyOrderId)).should.equal(buyer);
        (await renLedger.orderTrader(sellOrderId)).should.equal(seller);

        await renLedger.confirmOrder(buyOrderId, [sellOrderId], { from: darknode });

        await wallet.submitOrder(...buy);
        await wallet.submitOrder(...sell);

        console.log(`Seller has ${((await wallet.getBalance(seller, REN)) * 1e-18).toString()} REN, ${((await wallet.getBalance(seller, ETH)) * 1e-18).toString()} ETH`);
        console.log(`Buyer has ${((await wallet.getBalance(buyer, REN)) * 1e-18).toString()} REN, ${((await wallet.getBalance(buyer, ETH)) * 1e-18).toString()} ETH`);

        await wallet.submitMatch(buy[0], sell[0]);

        console.log(`Seller has ${((await wallet.getBalance(seller, REN)) * 1e-18).toString()} REN, ${((await wallet.getBalance(seller, ETH)) * 1e-18).toString()} ETH`);
        console.log(`Buyer has ${((await wallet.getBalance(buyer, REN)) * 1e-18).toString()} REN, ${((await wallet.getBalance(buyer, ETH)) * 1e-18).toString()} ETH`);

        throw 0;
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

