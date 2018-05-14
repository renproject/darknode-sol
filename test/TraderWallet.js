const TraderWallet = artifacts.require("TraderWallet");
const RepublicToken = artifacts.require("RepublicToken");

const BigNumber = require("bignumber.js");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

contract("TraderWallet", function (accounts) {

    let wallet, token1, token2;

    beforeEach(async function () {
        token1 = await RepublicToken.new();
        token2 = await RepublicToken.new();
        wallet = await TraderWallet.new(
        );
        // for (i = 1; i < accounts.length; i++) {
        //     await ren.transfer(accounts[i], 10000);
        // }
    });

    it("can hold tokens for a trader", async () => {
        const deposit1 = 100;
        const deposit2 = 50;

        // Get ERC20 balance for token1 and token2
        const previous1 = await token1.balanceOf(accounts[0]);
        const previous2 = await token2.balanceOf(accounts[0]);

        // Approve and deposit
        await token1.approve(wallet.address, deposit1, { from: accounts[0] });
        await wallet.deposit(token1.address, deposit1, { from: accounts[0] });
        await token2.approve(wallet.address, deposit2, { from: accounts[0] });
        await wallet.deposit(token2.address, deposit2, { from: accounts[0] });

        // Check that balance in wallet is updated
        const [tokens, balances] = await wallet.getBalances(accounts[0]);
        tokens.should.eql([token1.address, token2.address]);
        balances[0].toNumber().should.equal(deposit1);
        balances[1].toNumber().should.equal(deposit2);

        // Check that the correct amount of tokens has been withdrawn
        (await token1.balanceOf(accounts[0])).should.be.bignumber.equal(previous1.sub(deposit1));
        (await token2.balanceOf(accounts[0])).should.be.bignumber.equal(previous2.sub(deposit2));

        // Withdraw
        await wallet.withdraw(token1.address, deposit1, { from: accounts[0] });
        await wallet.withdraw(token2.address, deposit2, { from: accounts[0] });

        // Check that the tokens have been returned
        (await token1.balanceOf(accounts[0])).should.be.bignumber.equal(previous1);
        (await token2.balanceOf(accounts[0])).should.be.bignumber.equal(previous2);
    })

    it("can hold tokens for multiple traders", async () => {
        const deposit1 = 100;
        const deposit2 = 50;

        // Give accounts[1] some tokens
        await token1.transfer(accounts[1], deposit2 * 2);

        // Get ERC20 balance for token1 and token2
        const previous1 = await token1.balanceOf(accounts[0]);
        const previous2 = await token1.balanceOf(accounts[1]);

        // Approve and deposit
        await token1.approve(wallet.address, deposit1, { from: accounts[0] });
        await wallet.deposit(token1.address, deposit1, { from: accounts[0] });
        await token1.approve(wallet.address, deposit2, { from: accounts[1] });
        await wallet.deposit(token1.address, deposit2, { from: accounts[1] });

        // Check that balance in wallet is updated
        const [tokens1, balances1] = await wallet.getBalances(accounts[0]);
        tokens1.should.eql([token1.address]);
        balances1[0].toNumber().should.equal(deposit1);

        const [tokens2, balances2] = await wallet.getBalances(accounts[1]);
        tokens2.should.eql([token1.address]);
        balances2[0].toNumber().should.equal(deposit2);

        // Check that the correct amount of tokens has been withdrawn
        (await token1.balanceOf(accounts[0])).should.be.bignumber.equal(previous1.sub(deposit1));
        (await token1.balanceOf(accounts[1])).should.be.bignumber.equal(previous2.sub(deposit2));

        // Withdraw
        await wallet.withdraw(token1.address, deposit1, { from: accounts[0] });
        await wallet.withdraw(token1.address, deposit2, { from: accounts[1] });

        // Check that the tokens have been returned
        (await token1.balanceOf(accounts[0])).should.be.bignumber.equal(previous1);
        (await token1.balanceOf(accounts[1])).should.be.bignumber.equal(previous2);
    })

    it("throws for invalid withdrawal", async () => {
        const deposit1 = 100;

        // Approve and deposit
        await token1.approve(wallet.address, deposit1, { from: accounts[0] });
        await wallet.deposit(token1.address, deposit1, { from: accounts[0] });

        // Withdraw more than deposited amount
        wallet.withdraw(token1.address, deposit1 * 2, { from: accounts[0] })
            .should.be.rejectedWith(Error);

        // Withdraw
        await wallet.withdraw(token1.address, deposit1, { from: accounts[0] });

        // Withdraw again
        wallet.withdraw(token1.address, deposit1, { from: accounts[0] })
            .should.be.rejectedWith(Error);
    })

    it("can hold ether for a trader", async () => {
        const deposit1 = 100;
        const ETH = 0x0;

        const previous = await web3.eth.getBalance(accounts[0]);

        // Approve and deposit
        const fee1 = await getFee(wallet.deposit(ETH, deposit1, { from: accounts[0], value: deposit1 }));

        // Balance should be (previous - fee1 - deposit1)
        (await web3.eth.getBalance(accounts[0])).should.be.bignumber.equal(previous.sub(fee1).sub(deposit1));

        // Withdraw
        const fee2 = await getFee(wallet.withdraw(ETH, deposit1, { from: accounts[0] }));

        // Balance should be (previous - fee1 - fee2)
        (await web3.eth.getBalance(accounts[0])).should.be.bignumber.equal(previous.sub(fee1).sub(fee2));
    })

});


async function getFee(txP) {
    const tx = await txP;
    const gasAmount = tx.receipt.gasUsed;
    const gasPrice = await web3.eth.getTransaction(tx.tx).gasPrice;
    return gasPrice.mul(gasAmount);
}