import BigNumber from "bignumber.js";

import { BN } from "bn.js";

import * as testUtils from "./helper/testUtils";

import { MINIMUM_BOND } from "./helper/testUtils";

import { DarknodeRegistryArtifact, DarknodeRegistryContract } from "./bindings/darknode_registry";
import { DarknodeRewardVaultArtifact, DarknodeRewardVaultContract } from "./bindings/darknode_reward_vault";
import { ImpreciseTokenArtifact } from "./bindings/imprecise_token";
import { NonCompliantTokenArtifact } from "./bindings/non_compliant_token";
import { NormalTokenArtifact } from "./bindings/normal_token";
import { RepublicTokenArtifact, RepublicTokenContract } from "./bindings/republic_token";
import { ReturnsFalseTokenArtifact } from "./bindings/returns_false_token";
import { ReverterArtifact } from "./bindings/reverter";

const RepublicToken = artifacts.require("RepublicToken") as RepublicTokenArtifact;
const DarknodeRegistry = artifacts.require("DarknodeRegistry") as DarknodeRegistryArtifact;
const DarknodeRewardVault = artifacts.require("DarknodeRewardVault") as DarknodeRewardVaultArtifact;
const Reverter = artifacts.require("Reverter") as ReverterArtifact;
const ImpreciseToken = artifacts.require("ImpreciseToken") as ImpreciseTokenArtifact;
const NonCompliantToken = artifacts.require("NonCompliantToken") as NonCompliantTokenArtifact;
const NormalToken = artifacts.require("NormalToken") as NormalTokenArtifact;
const ReturnsFalseToken = artifacts.require("ReturnsFalseToken") as ReturnsFalseTokenArtifact;

contract("DarknodeRewardVault", (accounts: string[]) => {

    let ren: RepublicTokenContract;
    let dnr: DarknodeRegistryContract;
    let darknodeRewardVault: DarknodeRewardVaultContract;
    let darknode1: string, darknode2: string, darknodeOperator: string;
    let TOKEN1, TOKEN2, TOKEN3, TOKEN4, TOKEN5, ETH;

    before(async () => {

        ren = await RepublicToken.deployed();
        dnr = await DarknodeRegistry.deployed();
        darknodeRewardVault = await DarknodeRewardVault.deployed();

        TOKEN1 = await RepublicToken.new();
        TOKEN2 = await ImpreciseToken.new();
        TOKEN3 = await NormalToken.new();
        TOKEN4 = await NonCompliantToken.new();
        TOKEN5 = await ReturnsFalseToken.new();

        ETH = {
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: () => 18,
            approve: () => null,
            transfer: (to, value) => null,
            balanceOf: (address) => web3.eth.getBalance(address),
        };

        // Register all nodes
        darknode1 = accounts[8];
        darknode2 = accounts[4];

        darknodeOperator = accounts[9];

        for (const darknode of [darknode1, darknode2]) {
            await ren.transfer(darknodeOperator, MINIMUM_BOND);
            await ren.approve(dnr.address, MINIMUM_BOND, { from: darknodeOperator });
            await dnr.register(darknode, "0x00", MINIMUM_BOND, { from: darknodeOperator });
        }
        await dnr.epoch();

        (await dnr.getDarknodeOwner(darknode1))
            .should.equal(darknodeOperator);

        (await dnr.getDarknodeOwner(darknode2))
            .should.equal(darknodeOperator);
    });

    it("can update the darknode registry address", async () => {
        await darknodeRewardVault.updateDarknodeRegistry(testUtils.NULL);
        (await darknodeRewardVault.darknodeRegistry()).should.equal(testUtils.NULL);
        await darknodeRewardVault.updateDarknodeRegistry(dnr.address, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // not owner
        await darknodeRewardVault.updateDarknodeRegistry(dnr.address);
        (await darknodeRewardVault.darknodeRegistry()).should.equal(dnr.address);
    });

    context("can deposit and withdraw funds", async () => {

        // Deposit rewards
        const names = ["TOKEN1", "TOKEN2", "TOKEN3", "TOKEN4", "TOKEN5", "ETH"];
        for (let i = 0; i < names.length; i++) {
            it(names[i], async () => {

                const sum = {
                    [darknode1]: new BigNumber(0),
                    [darknode2]: new BigNumber(0),
                };

                const token = [TOKEN1, TOKEN2, TOKEN3, TOKEN4, TOKEN5, ETH][i];
                const decimals = await token.decimals();

                // Set fee balance to 0 by withdrawing
                for (const darknode of [darknode1, darknode2]) {
                    sum[darknode] = new BigNumber(
                        (await darknodeRewardVault.darknodeBalances(darknode, token.address)).toString(),
                    );
                }

                for (const account of accounts) {
                    for (const darknode of [darknode1, darknode2]) {
                        const fee = new BigNumber(Math.random())
                            .multipliedBy(new BigNumber(10).exponentiatedBy(decimals))
                            .integerValue();
                        await token.transfer(account, fee);

                        const value = token === ETH ? fee.toFixed() : 0;
                        await token.approve(darknodeRewardVault.address, fee, { from: account });
                        await darknodeRewardVault.deposit(
                            darknode, token.address, fee.toFixed(), { value, from: account },
                        );
                        sum[darknode] = sum[darknode].plus(fee);
                    }
                }

                for (const darknode of [darknode1, darknode2]) {
                    const balanceBefore = new BN(await token.balanceOf(darknodeOperator));
                    await darknodeRewardVault.withdraw(darknode, token.address);
                    const balanceAfter = new BN(await token.balanceOf(darknodeOperator));

                    balanceAfter.should.bignumber.equal(balanceBefore.add(new BN(sum[darknode].toFixed())));
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
        await ren.approve(reverter.address, MINIMUM_BOND);
        await reverter.register(dnr.address, ren.address, darknode3, "0x00", MINIMUM_BOND);
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
