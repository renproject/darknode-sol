const TraderWallet = artifacts.require("TraderWallet");
const RepublicToken = artifacts.require("RepublicToken");
const BitcoinMock = artifacts.require("BitcoinMock");

const BigNumber = require("bignumber.js");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

const web3_1 = require("web3");

contract.only("TraderWallet", function (accounts) {

    let wallet, lowToken, highToken;
    const buyer = accounts[0];
    const seller = accounts[1];

    beforeEach(async function () {
        lowToken = await RepublicToken.new();
        highToken = await BitcoinMock.new();
        wallet = await TraderWallet.new(
        );

        // web3.eth.accounts.create();
    });

    it("can rebalance", async () => {
        const renDeposit = 1 * 1e18; // REN
        const btcDeposit = 950; // SATS

        // Give seller some tokens
        await highToken.transfer(seller, btcDeposit * 2);

        // Approve and deposit
        await lowToken.approve(wallet.address, renDeposit, { from: buyer });
        await wallet.deposit(lowToken.address, renDeposit, { from: buyer });
        await highToken.approve(wallet.address, btcDeposit, { from: seller });
        await wallet.deposit(highToken.address, btcDeposit, { from: seller });


        // Buying REN for BTC
        const price1 = [200, 7]; // priceToTuple(0.0000095); // Price of 1 REN in BTC
        const volume1 = [200, 7]; // volumeToTuple(0.0000380); // Volume in BTC
        const buy = [
            123,
            price1[0],
            price1[1],
            volume1[0],
            volume1[1],
            volume1[0],
            volume1[1],
            buyer,
            lowToken.address,
            web3.sha3("buy"),
        ];

        const price2 = [200, 7]; // priceToTuple(0.0000095); // Price of 1 REN in BTC
        const volume2 = [200, 7]; // volumeToTuple(1); // Volume in REN
        const sell = [
            124,
            price2[0],
            price2[1],
            volume2[0],
            volume2[1],
            volume2[0],
            volume2[1],
            seller,
            highToken.address,
            web3.sha3("sell"),
        ];

        await wallet.submitOrder(...buy);
        await wallet.submitOrder(...sell);

        console.log((await wallet.getBalance(seller, highToken.address)).toString());
        console.log((await wallet.getBalance(buyer, lowToken.address)).toString());

        await wallet.submitMatch(buy[0], sell[0]);

        console.log((await wallet.getBalance(seller, highToken.address)).toString());
        console.log((await wallet.getBalance(buyer, lowToken.address)).toString());


        (0).should.equal(1);
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
function priceToTuple(price) {
    const shift = 10 ** 12;
    const exponentOffset = 26;
    const step = 0.005;
    const tuple = floatToTuple(shift, exponentOffset, step, price);
    console.assert(1 <= tuple[0] && tuple[0] <= 1999, `Expected c (${tuple[0]}) to be in [1,1999] in priceToTuple(${price})`);
    console.assert(0 <= tuple[1] && tuple[1] <= 52, `Expected q (${tuple[1]}) to be in [0,52] in priceToTuple(${price})`);
    return tuple;
}

// const tupleToPrice = (t) => {
//     return 5 * t.c * 10 ** (t.q - 26 - 12 - 3);
// }


function volumeToTuple(volume) {
    const shift = 10 ** 12;
    const exponentOffset = 0;
    const step = 0.2;
    const tuple = floatToTuple(shift, exponentOffset, step, volume);
    console.assert(1 <= tuple[0] && tuple[0] <= 49, `Expected c (${tuple[0]}) to be in [1,49] in volumeToTuple(${volume})`);
    console.assert(0 <= tuple[1] && tuple[1] <= 52, `Expected q (${tuple[1]}) to be in [0,52] in volumeToTuple(${volume})`);
    return tuple;
}

// const tupleToVolume = (t) => {
//     return 0.2 * t.c * 10 ** (t.q - 12)
// }


function floatToTuple(shift, exponentOffset, step, value) {
    const shifted = value * shift;

    const digits = -Math.floor(Math.log10(step)) + 1;
    const stepInt = step * 10 ** (digits - 1);

    // CALCULATE tuple
    let [c, exp] = significantDigits(shifted, digits, false);
    c = (c - (c % stepInt)) / step;

    // Simplify again if possible - e.g. [1910,32] becomes [191,33]
    let expAdd;
    [c, expAdd] = significantDigits(c, digits, true);
    exp += expAdd;

    const q = exponentOffset + exp;

    return [c, q];
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