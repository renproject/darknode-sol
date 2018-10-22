import BigNumber from "bignumber.js";

import * as testUtils from "./helper/testUtils";

import { MINIMUM_BOND } from "./helper/testUtils";

import { DarknodeRegistryArtifact, DarknodeRegistryContract } from "./bindings/darknode_registry";
import { DarknodeRewardVaultArtifact, DarknodeRewardVaultContract } from "./bindings/darknode_reward_vault";
import { RepublicTokenArtifact, RepublicTokenContract } from "./bindings/republic_token";
import { ReverterArtifact } from "./bindings/reverter";

const RepublicToken = artifacts.require("RepublicToken") as RepublicTokenArtifact;
const DarknodeRegistry = artifacts.require("DarknodeRegistry") as DarknodeRegistryArtifact;
const DarknodeRewardVault = artifacts.require("DarknodeRewardVault") as DarknodeRewardVaultArtifact;
const Reverter = artifacts.require("Reverter") as ReverterArtifact;
const ImpreciseToken = artifacts.require("ImpreciseToken") as RepublicTokenArtifact;
const NonCompliantToken = artifacts.require("NonCompliantToken") as RepublicTokenArtifact;
const NormalToken = artifacts.require("NormalToken") as RepublicTokenArtifact;
const ReturnsFalseToken = artifacts.require("ReturnsFalseToken") as RepublicTokenArtifact;
const TokenWithFees = artifacts.require("TokenWithFees") as RepublicTokenArtifact;

contract("DarknodeRewardVault", (accounts: string[]) => {

    let ren: RepublicTokenContract;
    let dnr: DarknodeRegistryContract;
    let darknodeRewardVault: DarknodeRewardVaultContract;
    let darknode1: string, darknode2: string, darknodeOperator: string;
    let TOKEN1;

    const ETH = {
        address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        decimals: async () => 18,
        approve: async (to, value) => null,
        transfer: async (to, value) => null,
        balanceOf: async (address) => web3.eth.getBalance(address),
    } as any as RepublicTokenContract;

    const ETHArtifact = {
        new: async () => ETH,
    };

    before(async () => {

        ren = await RepublicToken.deployed();
        dnr = await DarknodeRegistry.deployed();
        darknodeRewardVault = await DarknodeRewardVault.deployed();

        TOKEN1 = await RepublicToken.new();

        // Register all nodes
        darknode1 = accounts[8];
        darknode2 = accounts[4];

        darknodeOperator = accounts[9];

        for (const darknode of [darknode1, darknode2]) {
            await ren.transfer(darknodeOperator, MINIMUM_BOND.toFixed());
            await ren.approve(dnr.address, MINIMUM_BOND.toFixed(), { from: darknodeOperator });
            await dnr.register(darknode, "0x00", { from: darknodeOperator });
        }
        await dnr.epoch();

        (await dnr.getDarknodeOwner(darknode1))
            .should.equal(darknodeOperator);

        (await dnr.getDarknodeOwner(darknode2))
            .should.equal(darknodeOperator);
    });

    it("can update the darknode registry address", async () => {
        const previousDarknodeRegistry = await darknodeRewardVault.darknodeRegistry();

        // [CHECK] The function validates the new darknode registry
        await darknodeRewardVault.updateDarknodeRegistry(testUtils.NULL)
            .should.be.rejectedWith(null, /revert/);

        // [ACTION] Update the darknode registry to another address
        await darknodeRewardVault.updateDarknodeRegistry(darknodeRewardVault.address);
        // [CHECK] Verify the darknode registry address has been updated
        (await darknodeRewardVault.darknodeRegistry()).should.equal(darknodeRewardVault.address);

        // [CHECK] Only the owner can update the darknode registry
        await darknodeRewardVault.updateDarknodeRegistry(previousDarknodeRegistry, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // not owner

        // [RESET] Reset the darknode registry to the previous address
        await darknodeRewardVault.updateDarknodeRegistry(previousDarknodeRegistry);
        (await darknodeRewardVault.darknodeRegistry()).should.equal(previousDarknodeRegistry);
    });

    context("can deposit and withdraw funds", async () => {

        const testCases = [
            { contract: ETHArtifact, fees: 0, desc: "ether" },
            { contract: RepublicToken, fees: 0, desc: "ren" },
            { contract: NormalToken, fees: 0, desc: "standard token" },
            { contract: ReturnsFalseToken, fees: 0, desc: "alternate token" },
            { contract: NonCompliantToken, fees: 0, desc: "non compliant token" },
            { contract: TokenWithFees, fees: 3, desc: "token with fees" },
            { contract: ImpreciseToken, fees: 3, desc: "imprecise token" },
        ];

        // Deposit rewards
        for (const testCase of testCases) {
            it(testCase.desc, async () => {

                const sum = {
                    [darknode1]: new BigNumber(0),
                    [darknode2]: new BigNumber(0),
                };

                const token = await testCase.contract.new();
                const decimals = await token.decimals();

                // Set reward balance to 0 by withdrawing
                for (const darknode of [darknode1, darknode2]) {
                    sum[darknode] = new BigNumber(await darknodeRewardVault.darknodeBalances(darknode, token.address));
                }

                for (const account of accounts) {
                    for (const darknode of [darknode1, darknode2]) {
                        // FIXME: Test has some rounding issues with fees

                        const reward = new BigNumber(Math.random())
                            .multipliedBy(
                                new BigNumber(10)
                                    .exponentiatedBy(new BigNumber(decimals).toNumber() - 14),
                            )
                            .integerValue(BigNumber.ROUND_FLOOR)
                            .multipliedBy(new BigNumber(10).exponentiatedBy(14));
                        const fee = reward.multipliedBy(testCase.fees / 1000).integerValue(BigNumber.ROUND_FLOOR);

                        await token.transfer(account, reward.toFixed());

                        const newReward = reward.minus(fee);
                        const newFee = newReward.multipliedBy(testCase.fees / 1000).integerValue(BigNumber.ROUND_FLOOR);

                        const value = token === ETH ? newReward.toFixed() : 0;
                        await token.approve(darknodeRewardVault.address, newReward.toFixed(), { from: account });
                        await darknodeRewardVault.deposit(
                            darknode, token.address, newReward.toFixed(), { value, from: account },
                        ).should.not.be.rejected;

                        const newNewReward = newReward.minus(newFee);
                        const newNewFee = newNewReward.multipliedBy(testCase.fees / 1000)
                            .integerValue(BigNumber.ROUND_FLOOR);

                        sum[darknode] = sum[darknode].plus(newNewReward.minus(newNewFee));
                    }
                }

                for (const darknode of [darknode1, darknode2]) {
                    const balanceBefore = new BigNumber((await token.balanceOf(darknodeOperator)));
                    await darknodeRewardVault.withdraw(darknode, token.address);
                    const balanceAfter = new BigNumber((await token.balanceOf(darknodeOperator)));

                    const reward = sum[darknode];
                    const fee = reward.multipliedBy(testCase.fees / 1000).integerValue(BigNumber.ROUND_FLOOR);

                    balanceAfter.minus(balanceBefore)
                        .should.bignumber.equal(reward);
                }
            });
        }
    });

    it("checks that deposit amounts are valid", async () => {
        await darknodeRewardVault.deposit(darknode1, TOKEN1.address, 1)
            .should.be.rejectedWith(null, /revert/); // erc20 transfer error

        await darknodeRewardVault.deposit(darknode1, ETH.address, 1)
            .should.be.rejectedWith(null, /mismatched ether value/);
    });

    it("cannot deposit ether and erc20 with the same transaction", async () => {
        await TOKEN1.approve(darknodeRewardVault.address, 10);
        await darknodeRewardVault.deposit(
            darknode1, TOKEN1.address, 10, { value: 10 })
            .should.be.rejectedWith(null, /unexpected ether value/);
    });

    it("checks success of ERC20 withdrawal before updating balances", async () => {
        await TOKEN1.approve(darknodeRewardVault.address, 10);
        await darknodeRewardVault.deposit(darknode1, TOKEN1.address, 10);
        await TOKEN1.pause();

        await darknodeRewardVault.withdraw(darknode1, TOKEN1.address)
            .should.be.rejectedWith(null, /revert/); // erc20 transfer error, paused
        await TOKEN1.unpause();
    });

    it("checks success of ETH withdrawal before updating balances", async () => {
        const reverter = await Reverter.new();
        const darknode3 = accounts[5];
        await ren.approve(reverter.address, MINIMUM_BOND.toFixed());
        await reverter.register(dnr.address, ren.address, darknode3, "0x00", MINIMUM_BOND.toFixed());
        await dnr.epoch();

        await darknodeRewardVault.deposit(darknode3, ETH.address, 10, { value: 10 });

        await darknodeRewardVault.withdraw(darknode3, ETH.address)
            .should.be.rejectedWith(null, /malicious revert/);
    });

    it("checks the darknode operator is not 0x0", async () => {
        // darknodeOperator is not a darknode
        (await dnr.isRegistered(darknodeOperator)).should.be.false;
        await darknodeRewardVault.deposit(darknodeOperator, ETH.address, 1, { value: 1 });

        await darknodeRewardVault.withdraw(darknodeOperator, ETH.address)
            .should.be.rejectedWith(null, /invalid darknode owner/);
    });

});
