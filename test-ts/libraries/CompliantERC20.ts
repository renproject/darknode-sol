import { BN } from "bn.js";

import "../helper/testUtils";

import { StandardTokenContract } from "../bindings/standard_token";

import { CompatibleERC20TestArtifact, CompatibleERC20TestContract } from "../bindings/compatible_erc20_test";

const CompatibleERC20Test = artifacts.require("CompatibleERC20Test") as CompatibleERC20TestArtifact;
const NormalToken = artifacts.require("NormalToken");
const ReturnsFalseToken = artifacts.require("ReturnsFalseToken");
const NonCompliantToken = artifacts.require("NonCompliantToken");

contract("CompliantERC20", (accounts) => {

    let testContract: CompatibleERC20TestContract;

    before(async () => {
        testContract = await CompatibleERC20Test.new();
    });

    const testCases = [
        { contract: NormalToken, description: "standard token [true for success, throws for failure]" },
        { contract: ReturnsFalseToken, description: "alternate token [true for success, false for failure]" },
        { contract: NonCompliantToken, description: "non compliant token [nil for success, throws for failure]" },
    ];

    for (const testCase of testCases) {
        context(testCase.description, async () => {
            let token: StandardTokenContract;

            before(async () => {
                token = await testCase.contract.new();
            });

            it("approve and transferFrom", async () => {
                // Get balances before depositing
                const beforeSelf = new BN(await token.balanceOf(accounts[0]));
                const beforeTest = new BN(await token.balanceOf(testContract.address));

                // Approve and deposit
                await token.approve(testContract.address, 1);
                await testContract.deposit(token.address, 1);

                // Compare balances after depositing
                (await token.balanceOf(accounts[0])).should.bignumber.equal(beforeSelf.sub(new BN(1)));
                (await token.balanceOf(testContract.address)).should.bignumber.equal(beforeTest.add(new BN(1)));
            });

            it("transfer", async () => {
                // Get balances before depositing
                const beforeSelf = new BN(await token.balanceOf(accounts[0]));
                const beforeTest = new BN(await token.balanceOf(testContract.address));

                // Withdraw
                await testContract.withdraw(token.address, 1);

                // Compare balances after depositing
                (await token.balanceOf(accounts[0])).should.bignumber.equal(beforeSelf.add(new BN(1)));
                (await token.balanceOf(testContract.address)).should.bignumber.equal(beforeTest.sub(new BN(1)));
            });

            it("throws for invalid transferFrom", async () => {
                // Get balances before depositing
                const beforeSelf = new BN(await token.balanceOf(accounts[0]));
                const beforeTest = new BN(await token.balanceOf(testContract.address));

                // Approve and deposit
                await token.approve(testContract.address, 0);
                await testContract.deposit(token.address, 1)
                    .should.be.rejectedWith(null, /revert/);

                // Compare balances after depositing
                (await token.balanceOf(accounts[0])).should.bignumber.equal(beforeSelf);
                (await token.balanceOf(testContract.address)).should.bignumber.equal(beforeTest);
            });

            it("throws for invalid transfer", async () => {
                // Get balances before depositing
                const beforeSelf = new BN(await token.balanceOf(accounts[0]));
                const beforeTest = new BN(await token.balanceOf(testContract.address));

                // Withdraw
                await testContract.withdraw(token.address, 2)
                    .should.be.rejectedWith(null, /revert/);

                // Compare balances after depositing
                (await token.balanceOf(accounts[0])).should.bignumber.equal(beforeSelf);
                (await token.balanceOf(testContract.address)).should.bignumber.equal(beforeTest);
            });

            it("throws for invalid approve", async () => {
                // Get balances before depositing
                const beforeSelf = new BN(await token.balanceOf(accounts[0]));
                const beforeTest = new BN(await token.balanceOf(testContract.address));

                // Approve twice without resetting allowance
                await testContract.approve(token.address, 1);
                await testContract.approve(token.address, 1)
                    .should.be.rejectedWith(null, /revert/);

                // Can transfer from the contract (after transferring to it)
                await token.transfer(testContract.address, 1);
                await token.transferFrom(testContract.address, accounts[0], 1);

                // Compare balances after depositing
                (await token.balanceOf(accounts[0])).should.bignumber.equal(beforeSelf.add(new BN(1)));
                (await token.balanceOf(testContract.address)).should.bignumber.equal(beforeTest.sub(new BN(1)));
            });
        });
    }
});
