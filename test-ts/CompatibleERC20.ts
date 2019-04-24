import { BN } from "bn.js";

import "./helper/testUtils";

import { StandardTokenContract } from "./bindings/standard_token";

import { CompatibleERC20TestArtifact, CompatibleERC20TestContract } from "./bindings/compatible_erc20_test";

const CompatibleERC20Test = artifacts.require("CompatibleERC20Test") as CompatibleERC20TestArtifact;
const NormalToken = artifacts.require("NormalToken");
const ReturnsFalseToken = artifacts.require("ReturnsFalseToken");
const NonCompliantToken = artifacts.require("NonCompliantToken");
const TokenWithFees = artifacts.require("TokenWithFees");

contract("CompatibleERC20", (accounts) => {

    let mock: CompatibleERC20TestContract;

    before(async () => {
        mock = await CompatibleERC20Test.new();
    });

    const testCases = [
        { contract: NormalToken, fees: 0, desc: "standard token [true for success, throws for failure]" },
        { contract: ReturnsFalseToken, fees: 0, desc: "alternate token [true for success, false for failure]" },
        { contract: NonCompliantToken, fees: 0, desc: "non compliant token [nil for success, throws for failure]" },
        { contract: TokenWithFees, fees: 3, desc: "token with fees [true for success, throws for failure]" },
    ];

    const VALUE = new BN(100000000000000);

    for (const testCase of testCases) {
        context(testCase.desc, async () => {
            let token: StandardTokenContract;
            const FEE = VALUE.mul(new BN(testCase.fees)).div(new BN(1000));

            before(async () => {
                token = await testCase.contract.new();
            });

            it("approve and transferFrom", async () => {
                // Get balances before depositing
                const before = new BN(await token.balanceOf(accounts[0]));
                const after = new BN(await token.balanceOf(mock.address));

                // Approve and deposit
                await token.approve(mock.address, VALUE);
                await mock.deposit(token.address, VALUE);

                // Compare balances after depositing
                (await token.balanceOf(accounts[0]))
                    .should.bignumber.equal(before.sub(new BN(VALUE)));
                (await token.balanceOf(mock.address))
                    .should.bignumber.equal(after.add(new BN(VALUE.sub(FEE))));
            });

            it("transfer", async () => {
                // Get balances before depositing
                const before = new BN(await token.balanceOf(accounts[0]));
                const after = new BN(await token.balanceOf(mock.address));

                const NEW_VALUE = VALUE.sub(FEE);
                const NEW_FEE = NEW_VALUE.mul(new BN(testCase.fees)).div(new BN(1000));

                // Withdraw
                await mock.withdraw(token.address, NEW_VALUE);

                // Compare balances after depositing
                (await token.balanceOf(accounts[0]))
                    .should.bignumber.equal(before.add(new BN(NEW_VALUE.sub(NEW_FEE))));
                (await token.balanceOf(mock.address))
                    .should.bignumber.equal(after.sub(new BN(NEW_VALUE)));
            });

            it("throws for invalid transferFrom", async () => {
                // Get balances before depositing
                const before = new BN(await token.balanceOf(accounts[0]));
                const after = new BN(await token.balanceOf(mock.address));

                // Approve and deposit
                await token.approve(mock.address, 0);
                await mock.naiveDeposit(token.address, VALUE)
                    .should.be.rejectedWith(null, /revert/);

                // Compare balances after depositing
                (await token.balanceOf(accounts[0])).should.bignumber.equal(before);
                (await token.balanceOf(mock.address)).should.bignumber.equal(after);
            });

            it("throws for invalid transferFrom (with fee)", async () => {
                // Get balances before depositing
                const before = new BN(await token.balanceOf(accounts[0]));
                const after = new BN(await token.balanceOf(mock.address));

                // Approve and deposit
                await token.approve(mock.address, 0);
                await mock.deposit(token.address, VALUE)
                    .should.be.rejectedWith(null, /revert/);

                // Compare balances after depositing
                (await token.balanceOf(accounts[0])).should.bignumber.equal(before);
                (await token.balanceOf(mock.address)).should.bignumber.equal(after);
            });

            it("throws for invalid transfer", async () => {
                // Get balances before depositing
                const before = new BN(await token.balanceOf(accounts[0]));
                const after = new BN(await token.balanceOf(mock.address));

                // Withdraw
                await mock.withdraw(token.address, VALUE.mul(new BN(2)))
                    .should.be.rejectedWith(null, /revert/);

                // Compare balances after depositing
                (await token.balanceOf(accounts[0])).should.bignumber.equal(before);
                (await token.balanceOf(mock.address)).should.bignumber.equal(after);
            });

            it("throws for invalid approve", async () => {
                // Transfer to the contract
                await token.transfer(mock.address, VALUE);

                // Subtract fees
                const NEW_VALUE = VALUE.sub(FEE);
                const NEW_FEE = NEW_VALUE.mul(new BN(testCase.fees)).div(new BN(1000));

                // Get balances before transferring back
                const before = new BN(await token.balanceOf(accounts[0]));
                const after = new BN(await token.balanceOf(mock.address));

                // Approve twice without resetting allowance
                await mock.approve(token.address, NEW_VALUE);
                await mock.approve(token.address, NEW_VALUE)
                    .should.be.rejectedWith(null, /revert/);

                // Can transfer from the contract
                await token.transferFrom(mock.address, accounts[0], NEW_VALUE.sub(NEW_FEE));

                // Subtract fees second time
                const NEW_NEW_VALUE = NEW_VALUE.sub(NEW_FEE);
                const NEW_NEW_FEE = NEW_NEW_VALUE.mul(new BN(testCase.fees)).div(new BN(1000));

                // Compare balances after depositing
                (await token.balanceOf(accounts[0]))
                    .should.bignumber.equal(before.add(new BN(NEW_NEW_VALUE.sub(NEW_NEW_FEE))));
                (await token.balanceOf(mock.address))
                    .should.bignumber.equal(after.sub(new BN(NEW_NEW_VALUE)));
            });

            it("throws for naive deposit if it has fees", async () => {
                // Get balances before depositing
                const before = new BN(await token.balanceOf(accounts[0]));
                const after = new BN(await token.balanceOf(mock.address));

                // Approve and deposit
                await token.approve(mock.address, VALUE);
                if (testCase.fees) {
                    await mock.naiveDeposit(token.address, VALUE)
                        .should.be.rejectedWith(null, "incorrect balance in deposit");
                    await token.approve(mock.address, 0);
                } else {
                    await mock.naiveDeposit(token.address, VALUE);

                    // Compare balances after depositing
                    (await token.balanceOf(accounts[0]))
                        .should.bignumber.equal(before.sub(new BN(VALUE.sub(FEE))));
                    (await token.balanceOf(mock.address))
                        .should.bignumber.equal(after.add(new BN(VALUE)));
                }
            });
        });
    }
});
