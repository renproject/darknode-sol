const RepublicToken = artifacts.require("RepublicToken");
const RenLedger = artifacts.require("RenLedger");
const TraderAccounts = artifacts.require("TraderAccounts");

const BigNumber = require("bignumber.js");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

contract("TraderAccounts", function (accounts) {

    const ETH = 1;
    const REN = 65536;
    const TOKEN1 = 65537;
    const TOKEN2 = 65538;
    let wallet, tokenAddresses;

    beforeEach(async function () {
        tokenAddresses = {
            [ETH]: { address: 0x0 },
            [REN]: await RepublicToken.new(),
            [TOKEN1]: await RepublicToken.new(),
            [TOKEN2]: await RepublicToken.new(),
        }
        renLedger = await RenLedger.new(0, tokenAddresses[REN].address, 0x0);
        wallet = await TraderAccounts.new(renLedger.address);

        await wallet.registerToken(ETH, 0x0, 18);
        await wallet.registerToken(TOKEN1, tokenAddresses[TOKEN1].address, (await tokenAddresses[TOKEN1].decimals()));
        await wallet.registerToken(TOKEN2, tokenAddresses[TOKEN2].address, (await tokenAddresses[TOKEN2].decimals()));
    });

    it("can hold tokens for a trader", async () => {
        const deposit1 = 100;
        const deposit2 = 50;

        // Get ERC20 balance for tokens
        const previous1 = await tokenAddresses[TOKEN1].balanceOf(accounts[0]);
        const previous2 = await tokenAddresses[TOKEN2].balanceOf(accounts[0]);

        // Approve and deposit
        await tokenAddresses[TOKEN1].approve(wallet.address, deposit1, { from: accounts[0] });
        await wallet.deposit(TOKEN1, deposit1, { from: accounts[0] });
        await tokenAddresses[TOKEN2].approve(wallet.address, deposit2, { from: accounts[0] });
        await wallet.deposit(TOKEN2, deposit2, { from: accounts[0] });

        // Check that balance in wallet is updated
        const [tokens, balances] = await wallet.getBalances(accounts[0]);
        tokens[0].toNumber().should.equal(TOKEN1);
        tokens[1].toNumber().should.equal(TOKEN2);
        balances[0].toNumber().should.equal(deposit1);
        balances[1].toNumber().should.equal(deposit2);

        // Check that the correct amount of tokens has been withdrawn
        (await tokenAddresses[TOKEN1].balanceOf(accounts[0])).should.be.bignumber.equal(previous1.sub(deposit1));
        (await tokenAddresses[TOKEN2].balanceOf(accounts[0])).should.be.bignumber.equal(previous2.sub(deposit2));

        // Withdraw
        await wallet.withdraw(TOKEN1, deposit1, { from: accounts[0] });
        await wallet.withdraw(TOKEN2, deposit2, { from: accounts[0] });

        // Check that the tokens have been returned
        (await tokenAddresses[TOKEN1].balanceOf(accounts[0])).should.be.bignumber.equal(previous1);
        (await tokenAddresses[TOKEN2].balanceOf(accounts[0])).should.be.bignumber.equal(previous2);
    })

    it("can hold tokens for multiple traders", async () => {
        const deposit1 = 100;
        const deposit2 = 50;

        // Give accounts[1] some tokens
        await tokenAddresses[TOKEN1].transfer(accounts[1], deposit2 * 2);

        // Get ERC20 balance for tokenAddresses[TOKEN1] and tokenAddresses[TOKEN2]
        const previous1 = await tokenAddresses[TOKEN1].balanceOf(accounts[0]);
        const previous2 = await tokenAddresses[TOKEN1].balanceOf(accounts[1]);

        // Approve and deposit
        await tokenAddresses[TOKEN1].approve(wallet.address, deposit1, { from: accounts[0] });
        await wallet.deposit(TOKEN1, deposit1, { from: accounts[0] });
        await tokenAddresses[TOKEN1].approve(wallet.address, deposit2, { from: accounts[1] });
        await wallet.deposit(TOKEN1, deposit2, { from: accounts[1] });

        // Check that balance in wallet is updated
        const [tokens1, balances1] = await wallet.getBalances(accounts[0]);
        tokens1[0].toNumber().should.equal(TOKEN1);
        balances1[0].toNumber().should.equal(deposit1);

        const [tokens2, balances2] = await wallet.getBalances(accounts[1]);
        tokens2[0].toNumber().should.equal(TOKEN1);
        balances2[0].toNumber().should.equal(deposit2);

        // Check that the correct amount of tokens has been withdrawn
        (await tokenAddresses[TOKEN1].balanceOf(accounts[0])).should.be.bignumber.equal(previous1.sub(deposit1));
        (await tokenAddresses[TOKEN1].balanceOf(accounts[1])).should.be.bignumber.equal(previous2.sub(deposit2));

        // Withdraw
        await wallet.withdraw(TOKEN1, deposit1, { from: accounts[0] });
        await wallet.withdraw(TOKEN1, deposit2, { from: accounts[1] });

        // Check that the tokens have been returned
        (await tokenAddresses[TOKEN1].balanceOf(accounts[0])).should.be.bignumber.equal(previous1);
        (await tokenAddresses[TOKEN1].balanceOf(accounts[1])).should.be.bignumber.equal(previous2);
    })

    it("throws for invalid withdrawal", async () => {
        const deposit1 = 100;

        // Approve and deposit
        await tokenAddresses[TOKEN1].approve(wallet.address, deposit1, { from: accounts[0] });
        await wallet.deposit(TOKEN1, deposit1, { from: accounts[0] });

        // Withdraw more than deposited amount
        wallet.withdraw(TOKEN1, deposit1 * 2, { from: accounts[0] })
            .should.be.rejectedWith(Error);

        // Withdraw
        await wallet.withdraw(TOKEN1, deposit1, { from: accounts[0] });

        // Withdraw again
        wallet.withdraw(TOKEN1, deposit1, { from: accounts[0] })
            .should.be.rejectedWith(Error);
    })

    it("can deposit and withdraw multiple times", async () => {
        const deposit1 = 100;
        const deposit2 = 50;

        // Approve and deposit
        await tokenAddresses[TOKEN1].approve(wallet.address, deposit1 + deposit2, { from: accounts[0] });
        await wallet.deposit(TOKEN1, deposit1, { from: accounts[0] });
        await wallet.deposit(TOKEN1, deposit2, { from: accounts[0] });

        // Withdraw
        await wallet.withdraw(TOKEN1, deposit1, { from: accounts[0] });
        await wallet.withdraw(TOKEN1, deposit2, { from: accounts[0] });
    })

    it("can hold ether for a trader", async () => {
        const deposit1 = 1;

        const previous = await web3.eth.getBalance(accounts[0]);

        // Approve and deposit
        const fee1 = await getFee(wallet.deposit(ETH, deposit1, { from: accounts[0], value: deposit1 }));

        // Balance should be (previous - fee1 - deposit1)
        const after = (await web3.eth.getBalance(accounts[0]));
        after.should.be.bignumber.equal(previous.sub(fee1).sub(deposit1));

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