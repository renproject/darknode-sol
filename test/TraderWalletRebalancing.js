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
        const renDeposit = 1 * 1e18;
        const btcDeposit = 1 * 1e8;

        // Give seller some tokens
        await highToken.transfer(seller, btcDeposit * 2);

        // Approve and deposit
        await lowToken.approve(wallet.address, renDeposit, { from: buyer });
        await wallet.deposit(lowToken.address, renDeposit, { from: buyer });
        await highToken.approve(wallet.address, btcDeposit, { from: seller });
        await wallet.deposit(highToken.address, btcDeposit, { from: seller });

        const price = priceToTuple(0.0000095);
        const volume = volumeToTuple(1);
        const buy = [
            123,
            price[0],
            price[1],
            volume[0],
            volume[1],
            volume[0],
            volume[1],
            buyer,
            highToken.address,
            0,
        ];

        const sell = [
            124,
            price[0],
            price[1],
            volume[0],
            volume[1],
            volume[0],
            volume[1],
            buyer,
            lowToken,
            web3.sha3("sell"),
        ];

        await wallet.submitOrder(...buy);
        // await wallet.submitOrder(...sell);

        // await wallet.submitMatch(buy[0], sell[0]);
    })

});


async function getFee(txP) {
    const tx = await txP;
    const gasAmount = tx.receipt.gasUsed;
    const gasPrice = await web3.eth.getTransaction(tx.tx).gasPrice;
    return gasPrice.mul(gasAmount);
}



function priceToTuple(price) {
    const shift = 10 ** 12;
    const exponentOffset = 25;
    const step = 1;
    const digits = 2;
    return floatToTuple(shift, exponentOffset, step, digits, price);
}

function volumeToTuple(volume) {
    const shift = 10 ** 12;
    const exponentOffset = 0;
    const step = 2;
    const digits = 2;
    return floatToTuple(shift, exponentOffset, step, digits, volume);
}

function floatToTuple(shift, exponentOffset, step, digits, value) {
    const shifted = value * shift;

    // CALCULATE tuple
    let [c, exp] = significantDigits(shifted, digits, false);
    c = (c - (c % step)) * (10 / step);
    let expAdd;
    [c, expAdd] = significantDigits(c, digits, true);
    exp += expAdd;

    const q = exponentOffset + exp;

    // ASSERT calculation
    // const left = (0.1 * c * 10 ** (q - exponentOffset)).toFixed(Math.abs(q - exponentOffset) + 1);
    // const right = shifted.toFixed(Math.abs(q - exponentOffset) + 1)
    // console.assert(left === right, `Expected ${left} to equal ${right}`);
    // console.assert(1 <= c && c <= 99, `Expected c to be in [1,99]: ${c}`);
    // console.assert(0 <= q && q <= 52, `Expected q to be in [0,52]: ${q}`);

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
