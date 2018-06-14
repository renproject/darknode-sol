const RenExTokens = artifacts.require("RenExTokens");
const RenExBalances = artifacts.require("RenExBalances");
const RenExSettlement = artifacts.require("RenExSettlement");
const RenLedger = artifacts.require("RenLedger");
const RepublicToken = artifacts.require("RepublicToken");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const BitcoinMock = artifacts.require("BitcoinMock");
const DGXMock = artifacts.require("DGXMock");

// Two big number libraries are used - BigNumber decimal support
// while BN has better bitwise operations
const BigNumber = require("bignumber.js");
const BN = require('bn.js');

const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.should();

contract("RenExSettlement", function (accounts) {

    const buyer = accounts[0];
    const seller = accounts[1];
    const darknode = accounts[2];
    let tokenAddresses, renLedger, renExSettlement, renExBalances;

    before(async function () {
        [tokenAddresses, renLedger, renExSettlement, renExBalances] = await setup(darknode);
    });

    it("order", async () => {
        await renLedger.openBuyOrder(
            "0xee83f7cb5f09dc8f4ad6bd3f994382de3d54e3688c00fb6d0c635143df78cb123d2b6503e401e2a09f653e7f46eed1fd3c76b8073ce5aaedc1a906026e677b7d01",
            "0x0df993f660f54781d6c5fbf8c2511b6a82b92e06a5e60563b3a206f6a878418d",
        )

        await renLedger.openSellOrder(
            "0xfc4c02d195720b5600d3f32f9551a27c15209bcbd1c4c0797fc981270653c9bd5071dc5e8eb40c97ab6ff92a835f5a9b78b607dfb1000fad5bcb74ba2f25e51e00",
            "0xb520c497951fc91ced08bde0130e47f2d30a7fe312784dffe243118e0e98bee8",
        )

        await renLedger.confirmOrder("0x0df993f660f54781d6c5fbf8c2511b6a82b92e06a5e60563b3a206f6a878418d", ["0xb520c497951fc91ced08bde0130e47f2d30a7fe312784dffe243118e0e98bee8"], { from: darknode })

        await renExSettlement.submitOrder(
            "0x0df993f660f54781d6c5fbf8c2511b6a82b92e06a5e60563b3a206f6a878418d",
            "0x0000000000000000000000000000000000000000000000000000000000000001",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x000000000000000000000000000000000000000000000000000000005b21c0a3",
            "0x0000000000000000000000000000000000000000000000000000010000010000",
            "0x0000000000000000000000000000000000000000000000000000000000000002",
            "0x0000000000000000000000000000000000000000000000000000000000000028",
            "0x0000000000000000000000000000000000000000000000000000000000000005",
            "0x000000000000000000000000000000000000000000000000000000000000000c",
            "0x0000000000000000000000000000000000000000000000000000000000000005",
            "0x000000000000000000000000000000000000000000000000000000000000000c",
            "0x0000000000000000000000000000000000000000000000000000000000000000"
        )

        await renExSettlement.submitOrder(
            "0xb520c497951fc91ced08bde0130e47f2d30a7fe312784dffe243118e0e98bee8",
            "0x0000000000000000000000000000000000000000000000000000000000000001",
            "0x0000000000000000000000000000000000000000000000000000000000000001",
            "0x000000000000000000000000000000000000000000000000000000005b21c0a3",
            "0x0000000000000000000000000000000000000000000000000000010000010000",
            "0x0000000000000000000000000000000000000000000000000000000000000002",
            "0x0000000000000000000000000000000000000000000000000000000000000028",
            "0x0000000000000000000000000000000000000000000000000000000000000005",
            "0x000000000000000000000000000000000000000000000000000000000000000c",
            "0x0000000000000000000000000000000000000000000000000000000000000005",
            "0x000000000000000000000000000000000000000000000000000000000000000c",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
        )

        // await renExSettlement.submitMatch(
        //     "0x0df993f660f54781d6c5fbf8c2511b6a82b92e06a5e60563b3a206f6a878418d",
        //     "0xb520c497951fc91ced08bde0130e47f2d30a7fe312784dffe243118e0e98bee8"
        // )
    })

    it("order", async () => {

        const sell = parseOutput(`
        Function: submitOrder(bytes32 _id, uint8 _orderType, uint8 _parity, uint64 _expiry, uint64 _tokens, uint16 _priceC, uint16 _priceQ, uint16 _volumeC, uint16 _volumeQ, uint16 _minimumVolumeC, uint16 _minimumVolumeQ, uint256 _nonceHash)

MethodID: 0x177d19c3
[0]:  0af673072171578f5238b6c4800c37e2803035d9dec456a1f72367b1245d92de
[1]:  0000000000000000000000000000000000000000000000000000000000000001
[2]:  0000000000000000000000000000000000000000000000000000000000000001
[3]:  000000000000000000000000000000000000000000000000000000005b1b2867
[4]:  0000000000000000000000000000000000000000000000000000000100000100
[5]:  000000000000000000000000000000000000000000000000000000000000014f
[6]:  0000000000000000000000000000000000000000000000000000000000000022
[7]:  0000000000000000000000000000000000000000000000000000000000000005
[8]:  000000000000000000000000000000000000000000000000000000000000000e
[9]:  0000000000000000000000000000000000000000000000000000000000000008
[10]: 0000000000000000000000000000000000000000000000000000000000000008
[11]: 0000000000000000000000000000000000000000000000000000000000000000
        `);

        const buy = parseOutput(`
        Function: submitOrder(bytes32 _id, uint8 _orderType, uint8 _parity, uint64 _expiry, uint64 _tokens, uint16 _priceC, uint16 _priceQ, uint16 _volumeC, uint16 _volumeQ, uint16 _minimumVolumeC, uint16 _minimumVolumeQ, uint256 _nonceHash)

MethodID: 0x177d19c3
[0]:  fa6dc7a09cfafec63bdaa6d0f725a08ab877ebf03b5e6cfb024107ff779a66d2
[1]:  0000000000000000000000000000000000000000000000000000000000000001
[2]:  0000000000000000000000000000000000000000000000000000000000000000
[3]:  000000000000000000000000000000000000000000000000000000005b1b3144
[4]:  0000000000000000000000000000000000000000000000000000000100000100
[5]:  000000000000000000000000000000000000000000000000000000000000014f
[6]:  0000000000000000000000000000000000000000000000000000000000000022
[7]:  0000000000000000000000000000000000000000000000000000000000000005
[8]:  000000000000000000000000000000000000000000000000000000000000000c
[9]:  0000000000000000000000000000000000000000000000000000000000000008
[10]: 0000000000000000000000000000000000000000000000000000000000000008
[11]: 0000000000000000000000000000000000000000000000000000000000000000
`)

        await submitMatch(buy, sell, buyer, seller, darknode, renExSettlement, renExBalances, tokenAddresses, renLedger);
    })

    it("order", async () => {
        const tokens = market(DGX, REN);
        const buy = { tokens, price: 1, volume: 2 /* DGX */ };
        const sell = { tokens, price: 0.95, volume: 1 /* REN */ };

        (await submitMatch(buy, sell, buyer, seller, darknode, renExSettlement, renExBalances, tokenAddresses, renLedger))
            .should.eql([0.975, 0.975 /* DGX */, 1 /* REN */])
    })

    it("order", async () => {
        const tokens = market(DGX, REN);
        const buy = { tokens, price: 1, volume: 1 /* DGX */ };
        const sell = { tokens, price: 0.95, volume: 2 /* REN */ };

        (await submitMatch(buy, sell, buyer, seller, darknode, renExSettlement, renExBalances, tokenAddresses, renLedger))
            .should.eql([0.975, 1 /* DGX */, 1.0256410256410258 /* REN */]);
    })

    it("order", async () => {
        const tokens = market(DGX, REN);
        const buy = { tokens, price: 0.5, volume: 1 /* DGX */ };
        const sell = { tokens, price: 0.5, volume: 2 /* REN */ };

        (await submitMatch(buy, sell, buyer, seller, darknode, renExSettlement, renExBalances, tokenAddresses, renLedger))
            .should.eql([0.5, 1 /* DGX */, 2 /* REN */])
    })

    it("order", async () => {
        const tokens = market(DGX, REN);
        const buy = { tokens, price: 1, volume: 1 /* DGX */ };
        // More precise than the number of decimals DGX has
        const sell = { tokens, price: 0.0000000001, volume: 2 /* REN */ };

        (await submitMatch(buy, sell, buyer, seller, darknode, renExSettlement, renExBalances, tokenAddresses, renLedger))
            .should.eql([0.5, 1 /* DGX */, 1.9999999998 /* REN */])
    })

    it("order", async () => {
        const tokens = market(DGX, REN);
        const buy = { tokens, priceC: 1999, priceQ: 40, volume: 2 /* DGX */ };
        const sell = { tokens, priceC: 1999, priceQ: 40, volume: 1 /* REN */ };

        (await submitMatch(buy, sell, buyer, seller, darknode, renExSettlement, renExBalances, tokenAddresses, renLedger))
            .should.eql([999.5, 2 /* DGX */, 0.002001000500250125 /* REN */])
    })
});













const BTC = 0x0;
const ETH = 0x1;
const DGX = 0x100;
const REN = 0x10000;
const OrderParity = {
    BUY: 0,
    SELL: 1,
};
let prefix = web3.toHex("Republic Protocol: open: ");
const symbols = {
    [BTC]: "BTC",
    [ETH]: "ETH",
    [DGX]: "DGX",
    [REN]: "REN",
}

const market = (low, high) => {
    return new BN(low).mul(new BN(2).pow(new BN(32))).add(new BN(high));
}

const randomID = async () => {
    return await web3.sha3(Math.random().toString());
}






function parseOutput(scraped) {
    return {
        parity: getLine(scraped, 2).toNumber(),
        tokens: getLine(scraped, 4),
        priceC: getLine(scraped, 5).toNumber(),
        priceQ: getLine(scraped, 6).toNumber(),
        volumeC: getLine(scraped, 7).toNumber(),
        volumeQ: getLine(scraped, 8).toNumber(),
        minimumVolumeC: getLine(scraped, 9).toNumber(),
        minimumVolumeQ: getLine(scraped, 10).toNumber(),
    }
}
function getLine(scraped, lineno) {
    const re = new RegExp("\\n\\[" + lineno + "\\]:\\s*([0-9a-f]*)");
    return new BN(scraped.match(re)[1], 16);
}




async function submitMatch(buy, sell, buyer, seller, darknode, renExSettlement, renExBalances, tokenAddresses, renLedger) {

    (sell.parity === undefined || sell.parity !== buy.parity).should.be.true;
    if (buy.parity === 1) {
        sell, buy = buy, sell;
    }

    for (const order of [buy, sell]) {
        if (order.price !== undefined) {
            price = priceToTuple(order.price);
            order.priceC = price.c, order.priceQ = price.q;
        } else {
            order.price = tupleToPrice({ c: order.priceC, q: order.priceQ });
        }
        if (order.volume !== undefined) {
            volume = volumeToTuple(order.volume);
            order.volumeC = volume.c, order.volumeQ = volume.q;
        } else {
            order.volume = tupleToVolume({ c: order.volumeC, q: order.volumeQ }).toNumber();
        }

        if (order.minimumVolumeC === undefined || order.minimumVolumeQ === undefined) {
            if (order.minimumVolume !== undefined) {
                minimumVolume = volumeToTuple(order.minimumVolume);
                order.minimumVolumeC = minimumVolume.c, order.minimumVolumeQ = minimumVolume.q;
            } else {
                minimumVolume = volumeToTuple(order.volume);
                order.minimumVolumeC = minimumVolume.c, order.minimumVolumeQ = minimumVolume.q;
            }
        }
    }

    new BN(buy.tokens).eq(new BN(sell.tokens)).should.be.true;
    const tokens = new BN(buy.tokens);

    const lowToken = new BN(tokens.toArrayLike(Buffer, "be", 8).slice(0, 4)).toNumber();
    const highToken = new BN(tokens.toArrayLike(Buffer, "be", 8).slice(4, 8)).toNumber();

    const lowTokenInstance = tokenAddresses[lowToken];
    const highTokenInstance = tokenAddresses[highToken];

    buy.orderID = await randomID();
    let buyHash = await web3.sha3(prefix + buy.orderID.slice(2), { encoding: 'hex' });
    buy.expiry = 1641026487;
    buy.type = 0;
    buy.parity = OrderParity.BUY;
    buy.tokens = `0x${tokens.toString('hex')}`;
    buy.nonce = web3.sha3(1337);
    buy.signature = await web3.eth.sign(buyer, buyHash);


    sell.orderID = await randomID();
    let sellHash = await web3.sha3(prefix + sell.orderID.slice(2), { encoding: 'hex' });
    sell.type = 0; // type
    sell.parity = OrderParity.SELL; // parity
    sell.expiry = 1641026487; // FIXME: expiry
    sell.tokens = `0x${tokens.toString('hex')}`; // tokens
    sell.nonce = web3.sha3(1337);
    const sellSignature = await web3.eth.sign(seller, sellHash);

    const highDecimals = (await highTokenInstance.decimals()).toNumber();
    const lowDecimals = (await lowTokenInstance.decimals()).toNumber();

    // Approve and deposit
    const highDeposit = sell.volume * (10 ** highDecimals);
    const lowDeposit = buy.volume * (10 ** lowDecimals);

    if (lowToken !== ETH) {
        await lowTokenInstance.transfer(buyer, lowDeposit);
        await lowTokenInstance.approve(renExBalances.address, lowDeposit, { from: buyer });
        await renExBalances.deposit(lowTokenInstance.address, lowDeposit, { from: buyer });
    } else {
        await renExBalances.deposit(lowTokenInstance.address, lowDeposit, { from: buyer, value: lowDeposit });
    }

    if (highToken !== ETH) {
        await highTokenInstance.transfer(seller, highDeposit);
        await highTokenInstance.approve(renExBalances.address, highDeposit, { from: seller });
        await renExBalances.deposit(highTokenInstance.address, highDeposit, { from: seller });
    } else {
        await renExBalances.deposit(highTokenInstance.address, highDeposit, { from: seller, value: highDeposit });
    }

    await renLedger.openBuyOrder(buy.signature, buy.orderID, { from: buyer });
    await renLedger.openSellOrder(sellSignature, sell.orderID, { from: seller });

    (await renLedger.orderTrader(buy.orderID)).should.equal(buyer);
    (await renLedger.orderTrader(sell.orderID)).should.equal(seller);

    await renLedger.confirmOrder(buy.orderID, [sell.orderID], { from: darknode });

    await renExSettlement.submitOrder(buy.orderID, buy.type, buy.parity, buy.expiry, buy.tokens, buy.priceC, buy.priceQ, buy.volumeC, buy.volumeQ, buy.minimumVolumeC, buy.minimumVolumeQ, buy.nonce);
    await renExSettlement.submitOrder(sell.orderID, sell.type, sell.parity, sell.expiry, sell.tokens, sell.priceC, sell.priceQ, sell.volumeC, sell.volumeQ, sell.minimumVolumeC, sell.minimumVolumeQ, sell.nonce);

    console.log(`BUYER: price: ${buy.price} ${symbols[lowToken]}/${symbols[highToken]}, offering ${buy.volume} ${symbols[lowToken]}`)
    console.log(`SELLR: price: ${sell.price} ${symbols[lowToken]}/${symbols[highToken]}, offering ${sell.volume} ${symbols[highToken]}`)

    const buyerLowBefore = await renExBalances.traderBalances(buyer, lowTokenInstance.address);
    const buyerHighBefore = await renExBalances.traderBalances(buyer, highTokenInstance.address);
    const sellerLowBefore = await renExBalances.traderBalances(seller, lowTokenInstance.address);
    const sellerHighBefore = await renExBalances.traderBalances(seller, highTokenInstance.address);

    await renExSettlement.submitMatch(buy.orderID, sell.orderID);

    const matchID = web3.sha3(buy.orderID + sell.orderID.slice(2), { encoding: 'hex' });
    const match = await renExSettlement.matches(matchID);
    const priceMatched = match[0];
    const lowMatched = match[1];
    const highMatched = match[2];

    console.log(`MATCH: price: ${priceMatched.toNumber() / 10 ** lowDecimals} ${symbols[lowToken]}/${symbols[highToken]}, ${lowMatched.toNumber() / 10 ** lowDecimals} ${symbols[lowToken]} for ${highMatched.toNumber() / 10 ** highDecimals} ${symbols[highToken]}`)

    const buyerLowAfter = await renExBalances.traderBalances(buyer, lowTokenInstance.address);
    const buyerHighAfter = await renExBalances.traderBalances(buyer, highTokenInstance.address);
    const sellerLowAfter = await renExBalances.traderBalances(seller, lowTokenInstance.address);
    const sellerHighAfter = await renExBalances.traderBalances(seller, highTokenInstance.address);

    buyerLowBefore.sub(lowMatched).eq(buyerLowAfter).should.be.true;
    buyerHighBefore.add(highMatched).eq(buyerHighAfter).should.be.true;
    sellerLowBefore.add(lowMatched).eq(sellerLowAfter).should.be.true;
    sellerHighBefore.sub(highMatched).eq(sellerHighAfter).should.be.true;

    return [
        priceMatched.toNumber() / 10 ** lowDecimals,
        lowMatched.toNumber() / 10 ** lowDecimals,
        highMatched.toNumber() / 10 ** highDecimals,
    ];
}

async function setup(darknode) {
    const tokenAddresses = {
        [BTC]: await BitcoinMock.new(),
        [ETH]: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: () => new BigNumber(18), approve: () => null },
        [DGX]: await DGXMock.new(),
        [REN]: await RepublicToken.new(),
    };

    const dnr = await DarknodeRegistry.new(
        tokenAddresses[REN].address,
        0,
        1,
        0
    );
    const renLedger = await RenLedger.new(0, tokenAddresses[REN].address, dnr.address);
    const renExBalances = await RenExBalances.new();
    const renExTokens = await RenExTokens.new();
    const renExSettlement = await RenExSettlement.new(renLedger.address, renExTokens.address, renExBalances.address);
    await renExBalances.setRenExSettlementContract(renExSettlement.address);

    await renExTokens.registerToken(ETH, tokenAddresses[ETH].address, 18);
    await renExTokens.registerToken(BTC, tokenAddresses[BTC].address, (await tokenAddresses[BTC].decimals()).toNumber());
    await renExTokens.registerToken(DGX, tokenAddresses[DGX].address, (await tokenAddresses[DGX].decimals()).toNumber());
    await renExTokens.registerToken(REN, tokenAddresses[REN].address, (await tokenAddresses[REN].decimals()).toNumber());

    // Register darknode
    await dnr.register(darknode, "", 0, { from: darknode });
    await dnr.epoch();

    return [tokenAddresses, renLedger, renExSettlement, renExBalances];
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
    const tuple = floatToTuple(shift, exponentOffset, step, price, 1999);
    console.assert(0 <= tuple.c && tuple.c <= 1999, `Expected c (${tuple.c}) to be in [1,1999] in priceToTuple(${price})`);
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
    const tuple = floatToTuple(shift, exponentOffset, step, volume, 49);
    console.assert(0 <= tuple.c && tuple.c <= 49, `Expected c (${tuple.c}) to be in [1,49] in volumeToTuple(${volume})`);
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


function floatToTuple(shift, exponentOffset, step, value, max) {
    const shifted = value.times(shift);

    const digits = -Math.floor(Math.log10(step)) + 1;
    const stepInt = step * 10 ** (digits - 1);

    // CALCULATE tuple
    let [c, exp] = significantDigits(shifted.toNumber(), digits, false);
    c = (c - (c % stepInt)) / step;

    // Simplify again if possible - e.g. [1910,32] becomes [191,33]
    let expAdd;
    [c, expAdd] = significantDigits(c, digits, false);
    exp += expAdd;

    // TODO: Fixme
    while (c > max) {
        c /= 10;
        exp++;
    }

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

