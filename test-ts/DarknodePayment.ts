import { BN } from "bn.js";

import { DarknodePaymentArtifact, DarknodePaymentContract } from "./bindings/darknode_payment";
import { DarknodeRegistryArtifact, DarknodeRegistryContract } from "./bindings/darknode_registry";
import { ERC20Artifact, ERC20Contract } from "./bindings/erc20";

const ERC20 = artifacts.require("RepublicToken") as ERC20Artifact;
const DarknodePayment = artifacts.require("DarknodePayment") as DarknodePaymentArtifact;
const DarknodeRegistry = artifacts.require("DarknodeRegistry") as DarknodeRegistryArtifact;

contract("DarknodePayment", (accounts: string[]) => {

    let dnp: DarknodePaymentContract;
    let dai: ERC20Contract;
    let dnr: DarknodeRegistryContract;

    const broker = accounts[9];

    before(async () => {
        // Use a new DAI only for these tests
        dai = await ERC20.new();
        dnr = await DarknodeRegistry.deployed();
        dnp = await DarknodePayment.new("TESTING", dai.address, dnr.address);
    });

    it("can be paid DAI from a payee", async () => {
        const previousBalance = new BN(await dnp.contractBalance());

        // Approve the contract to use DAI
        const amount = new BN("100000000000000000");
        await dai.approve(dnp.address, amount);
        await dnp.deposit(amount);
        // We should expect the DAI balance to have increased by what we deposited
        (await dnp.contractBalance()).should.bignumber.equal(previousBalance.add(amount));
    });

    /*

        // Get ERC20Basic balance for tokens
        const previous1 = new BN(await TOKEN1.balanceOf(accounts[0]));
        const previous2 = new BN(await TOKEN2.balanceOf(accounts[0]));

        // Approve and deposit
        await TOKEN1.approve(renExBalances.address, deposit1, { from: accounts[0] });
        await renExBalances.deposit(TOKEN1.address, deposit1, { from: accounts[0] });
        await TOKEN2.approve(renExBalances.address, deposit2, { from: accounts[0] });
        await renExBalances.deposit(TOKEN2.address, deposit2, { from: accounts[0] });

        // Check that balance in renExBalances is updated
        (await renExBalances.traderBalances(accounts[0], TOKEN1.address)).should.bignumber.equal(deposit1);
        (await renExBalances.traderBalances(accounts[0], TOKEN2.address)).should.bignumber.equal(deposit2);

        // Check that the correct amount of tokens has been withdrawn
        (await TOKEN1.balanceOf(accounts[0])).should.bignumber.equal(previous1.sub(deposit1));
        (await TOKEN2.balanceOf(accounts[0])).should.bignumber.equal(previous2.sub(deposit2));

        // Withdraw
        let sig = await testUtils.signWithdrawal(renExBrokerVerifier, broker, accounts[0], TOKEN1.address);
        await renExBalances.withdraw(TOKEN1.address, deposit1, sig, { from: accounts[0] });
        sig = await testUtils.signWithdrawal(renExBrokerVerifier, broker, accounts[0], TOKEN2.address);
        await renExBalances.withdraw(TOKEN2.address, deposit2, sig, { from: accounts[0] });

        // Check that the tokens have been returned
        (await TOKEN1.balanceOf(accounts[0])).should.bignumber.equal(previous1);
        (await TOKEN2.balanceOf(accounts[0])).should.bignumber.equal(previous2);

        // Check that balance in renExBalances is zeroed
        (await renExBalances.traderBalances(accounts[0], TOKEN1.address)).should.bignumber.equal(0);
        (await renExBalances.traderBalances(accounts[0], TOKEN2.address)).should.bignumber.equal(0);
    });

    it("deposits validates the transfer", async () => {
        // Token
        await TOKEN1.approve(renExBalances.address, 1, { from: accounts[1] });
        await renExBalances.deposit(TOKEN1.address, 2, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // ERC20Basic transfer fails

        // ETH
        await renExBalances.deposit(ETH.address, 2, { from: accounts[1], value: 1 })
            .should.be.rejectedWith(null, /mismatched value parameter and tx value/);
    });
    */

});
