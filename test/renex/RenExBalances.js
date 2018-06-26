const RepublicToken = artifacts.require("RepublicToken");
const RewardVault = artifacts.require("RewardVault");
const RenExSettlement = artifacts.require("RenExSettlement");
const RenExBalances = artifacts.require("RenExBalances");
const WithdrawBlock = artifacts.require("WithdrawBlock");

const BigNumber = require("bignumber.js");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.should();

contract("RenExBalances", function (accounts) {

    let renExBalances, renExSettlement;
    let ETH, REN, TOKEN1, TOKEN2;

    beforeEach(async function () {
        ETH = { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" };
        REN = await RepublicToken.new();
        TOKEN1 = await RepublicToken.new();
        TOKEN2 = await RepublicToken.new();

        rewardVault = await RewardVault.new(0x0);
        renExBalances = await RenExBalances.new(rewardVault.address);
        const GWEI = 1000000000;
        renExSettlement = await RenExSettlement.new(0x0, 0x0, renExBalances.address, 100 * GWEI);
        await renExBalances.updateRenExSettlementContract(renExSettlement.address);
    });

    it("can update Reward Vault address", async () => {
        await renExBalances.updateRewardVault(0x0);
        (await renExBalances.rewardVaultContract()).should.equal("0x0000000000000000000000000000000000000000");
        await renExBalances.updateRewardVault(rewardVault.address, { from: accounts[1] })
            .should.be.rejected;
        await renExBalances.updateRewardVault(rewardVault.address);
        (await renExBalances.rewardVaultContract()).should.equal(rewardVault.address);
    })

    it("can hold tokens for a trader", async () => {
        const deposit1 = 100;
        const deposit2 = 50;

        // Get ERC20 balance for tokens
        const previous1 = new BigNumber(await TOKEN1.balanceOf(accounts[0]));
        const previous2 = new BigNumber(await TOKEN2.balanceOf(accounts[0]));

        // Approve and deposit
        await TOKEN1.approve(renExBalances.address, deposit1, { from: accounts[0] });
        await renExBalances.deposit(TOKEN1.address, deposit1, { from: accounts[0] });
        await TOKEN2.approve(renExBalances.address, deposit2, { from: accounts[0] });
        await renExBalances.deposit(TOKEN2.address, deposit2, { from: accounts[0] });

        // Check that balance in renExBalances is updated
        const { 0: tokens, 1: balances } = await renExBalances.getBalances.call(accounts[0]);
        tokens[0].should.equal(TOKEN1.address);
        tokens[1].should.equal(TOKEN2.address);
        balances[0].should.equal(deposit1.toString());
        balances[1].should.equal(deposit2.toString());

        // Check that the correct amount of tokens has been withdrawn
        (await TOKEN1.balanceOf(accounts[0])).should.equal(previous1.minus(deposit1).toFixed());
        (await TOKEN2.balanceOf(accounts[0])).should.equal(previous2.minus(deposit2).toFixed());

        // Withdraw
        await renExBalances.withdraw(TOKEN1.address, deposit1, { from: accounts[0] });
        await renExBalances.withdraw(TOKEN2.address, deposit2, { from: accounts[0] });

        // Check that the tokens have been returned
        (await TOKEN1.balanceOf(accounts[0])).should.equal(previous1.toFixed());
        (await TOKEN2.balanceOf(accounts[0])).should.equal(previous2.toFixed());
    })

    it("can hold tokens for multiple traders", async () => {
        const deposit1 = 100;
        const deposit2 = 50;

        // Give accounts[1] some tokens
        await TOKEN1.transfer(accounts[1], deposit2 * 2);

        // Get ERC20 balance for TOKEN1 and TOKEN2
        const previous1 = new BigNumber(await TOKEN1.balanceOf(accounts[0]));
        const previous2 = new BigNumber(await TOKEN1.balanceOf(accounts[1]));

        // Approve and deposit
        await TOKEN1.approve(renExBalances.address, deposit1, { from: accounts[0] });
        await renExBalances.deposit(TOKEN1.address, deposit1, { from: accounts[0] });
        await TOKEN1.approve(renExBalances.address, deposit2, { from: accounts[1] });
        await renExBalances.deposit(TOKEN1.address, deposit2, { from: accounts[1] });

        // Check that balance in renExBalances is updated
        const { 0: tokens1, 1: balances1 } = await renExBalances.getBalances(accounts[0]);
        tokens1[0].should.equal(TOKEN1.address);
        balances1[0].should.equal(deposit1.toString());

        const { 0: tokens2, 1: balances2 } = await renExBalances.getBalances(accounts[1]);
        tokens2[0].should.equal(TOKEN1.address);
        balances2[0].should.equal(deposit2.toString());

        // Check that the correct amount of tokens has been withdrawn
        (await TOKEN1.balanceOf(accounts[0])).should.equal(previous1.minus(deposit1).toFixed());
        (await TOKEN1.balanceOf(accounts[1])).should.equal(previous2.minus(deposit2).toFixed());

        // Withdraw
        await renExBalances.withdraw(TOKEN1.address, deposit1, { from: accounts[0] });
        await renExBalances.withdraw(TOKEN1.address, deposit2, { from: accounts[1] });

        // Check that the tokens have been returned
        (await TOKEN1.balanceOf(accounts[0])).should.equal(previous1.toFixed());
        (await TOKEN1.balanceOf(accounts[1])).should.equal(previous2.toFixed());
    })

    it("throws for invalid withdrawal", async () => {
        const deposit1 = 100;

        // Approve and deposit
        await TOKEN1.approve(renExBalances.address, deposit1, { from: accounts[0] });
        await renExBalances.deposit(TOKEN1.address, deposit1, { from: accounts[0] });

        // Withdraw more than deposited amount
        await renExBalances.withdraw(TOKEN1.address, deposit1 * 2, { from: accounts[0] })
            .should.be.rejected;

        // Token transfer fails
        await TOKEN1.pause();
        await renExBalances.withdraw(TOKEN1.address, deposit1, { from: accounts[0] })
            .should.be.rejected;
        await TOKEN1.unpause();

        // Withdraw
        await renExBalances.withdraw(TOKEN1.address, deposit1, { from: accounts[0] });

        // Withdraw again
        await renExBalances.withdraw(TOKEN1.address, deposit1, { from: accounts[0] })
            .should.be.rejected;
    })

    it("can deposit and withdraw multiple times", async () => {
        const deposit1 = 100;
        const deposit2 = 50;

        // Approve and deposit
        await TOKEN1.approve(renExBalances.address, deposit1 + deposit2, { from: accounts[0] });
        await renExBalances.deposit(TOKEN1.address, deposit1, { from: accounts[0] });
        await renExBalances.deposit(TOKEN1.address, deposit2, { from: accounts[0] });

        // Withdraw
        await renExBalances.withdraw(TOKEN1.address, deposit1, { from: accounts[0] });
        await renExBalances.withdraw(TOKEN1.address, deposit2, { from: accounts[0] });
    })

    it("can hold ether for a trader", async () => {
        const deposit1 = 1;

        const previous = new BigNumber(await web3.eth.getBalance(accounts[0]));

        // Approve and deposit
        const fee1 = await getFee(renExBalances.deposit(ETH.address, deposit1, { from: accounts[0], value: deposit1 }));

        // Balance should be (previous - fee1 - deposit1)
        const after = (await web3.eth.getBalance(accounts[0]));
        after.should.equal(previous.minus(fee1).minus(deposit1).toFixed());

        // Withdraw
        const fee2 = await getFee(renExBalances.withdraw(ETH.address, deposit1, { from: accounts[0] }));

        // Balance should be (previous - fee1 - fee2)
        (await web3.eth.getBalance(accounts[0])).should.equal(previous.minus(fee1).minus(fee2).toFixed());
    })

    it("only the settlement contract can call `incrementBalance` and `decrementBalance`", async () => {
        await renExBalances.incrementBalance(
            accounts[1],
            REN.address,
            1,
            { from: accounts[1] }
        ).should.be.rejected;

        await renExBalances.decrementBalanceWithFee(
            accounts[1],
            REN.address,
            0,
            0,
            accounts[1],
            { from: accounts[1] }
        ).should.be.rejected;
    });

    it("deposits validates the transfer", async () => {
        // Token
        await TOKEN1.approve(renExBalances.address, 1, { from: accounts[1] });
        await renExBalances.deposit(TOKEN1.address, 2, { from: accounts[1] })
            .should.be.rejected;

        // ETH
        await renExBalances.deposit(ETH.address, 2, { from: accounts[1], value: 1 })
            .should.be.rejected;
    });

    it("the RenExSettlement contract can approve and reject withdrawals", async () => {
        const renExSettlementAlt = await WithdrawBlock.new();
        await renExBalances.updateRenExSettlementContract(renExSettlementAlt.address);

        const deposit = 10;
        await TOKEN1.approve(renExBalances.address, deposit, { from: accounts[0] });
        await renExBalances.deposit(TOKEN1.address, deposit, { from: accounts[0] });

        // Withdrawal should not go through
        await renExBalances.withdraw(TOKEN1.address, deposit, { from: accounts[0] })
            .should.be.rejected;

        // Can withdraw after reverting settlement contract update
        await renExBalances.updateRenExSettlementContract(renExSettlement.address);
        await renExBalances.withdraw(TOKEN1.address, deposit, { from: accounts[0] });
    })
});


async function getFee(txP) {
    const tx = await txP;
    const gasAmount = tx.receipt.gasUsed;
    const gasPrice = (await web3.eth.getTransaction(tx.tx)).gasPrice;
    return new BigNumber(gasPrice).multipliedBy(gasAmount);
}