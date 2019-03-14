import { BN } from "bn.js";

import {
    ID, MINIMUM_BOND, PUBK, waitForEpoch,
} from "./helper/testUtils";


import { DarknodePaymentArtifact, DarknodePaymentContract } from "./bindings/darknode_payment";
import { DarknodeRegistryArtifact, DarknodeRegistryContract } from "./bindings/darknode_registry";
import { ERC20Artifact, ERC20Contract } from "./bindings/erc20";
import { RepublicTokenArtifact, RepublicTokenContract } from "./bindings/republic_token";

const RepublicToken = artifacts.require("RepublicToken") as RepublicTokenArtifact;
const ERC20 = artifacts.require("DAIToken") as ERC20Artifact;
const DarknodePayment = artifacts.require("DarknodePayment") as DarknodePaymentArtifact;
const DarknodeRegistry = artifacts.require("DarknodeRegistry") as DarknodeRegistryArtifact;

contract.only("DarknodePayment", (accounts: string[]) => {

    let dnp: DarknodePaymentContract;
    let dai: ERC20Contract;
    let dnr: DarknodeRegistryContract;
    let ren: RepublicTokenContract;

    const broker = accounts[9];

    before(async () => {
        ren = await RepublicToken.deployed();
        dai = await ERC20.deployed();
        dnr = await DarknodeRegistry.deployed();
        dnp = await DarknodePayment.deployed();

        // [ACTION] Register
        for (let i = 0; i < accounts.length; i++) {
            await ren.transfer(accounts[i], MINIMUM_BOND);
            await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[i] });
            // Register the darknodes under the account address
            await dnr.register(accounts[i], PUBK(i), { from: accounts[i] });
        }

        // Wait for epochs
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);
    });

    it("can be paid DAI from a payee", async () => {
        const previousBalance = new BN(await dnp.balance());

        // Approve the contract to use DAI
        const amount = new BN("100000000000000000");
        await dai.approve(dnp.address, amount);
        await dnp.deposit(amount);
        // We should expect the DAI balance to have increased by what we deposited
        (await dnp.balance()).should.bignumber.equal(previousBalance.add(amount));
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
