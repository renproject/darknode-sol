const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const ABCToken = artifacts.require("ABCToken");
const DarknodeRewardVault = artifacts.require("DarknodeRewardVault");
const Reverter = artifacts.require("Reverter");

import * as testUtils from "./helper/testUtils";
import { MINIMUM_BOND } from "./helper/testUtils";
import { BN } from "bn.js";

contract("DarknodeRewardVault", function (accounts: string[]) {

    let ren, dnr, darknodeRewardVault, darknode1, darknode2, darknodeOperator;
    let TOKEN1, TOKEN2, ETH;

    before(async function () {

        ren = await RepublicToken.deployed();
        dnr = await DarknodeRegistry.deployed();
        darknodeRewardVault = await DarknodeRewardVault.deployed();

        TOKEN1 = await RepublicToken.new();
        TOKEN2 = await ABCToken.new();
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
        await darknodeRewardVault.updateDarknodeRegistry(0x0);
        (await darknodeRewardVault.darknodeRegistry()).should.equal(testUtils.NULL);
        await darknodeRewardVault.updateDarknodeRegistry(dnr.address, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // not owner
        await darknodeRewardVault.updateDarknodeRegistry(dnr.address);
        (await darknodeRewardVault.darknodeRegistry()).should.equal(dnr.address);
    });

    it("can deposit and withdaw funds", async () => {
        let sum = {
            [darknode1]: {
                [TOKEN1.address]: 0,
                [TOKEN2.address]: 0,
                [ETH.address]: 0,
            },
            [darknode2]: {
                [TOKEN1.address]: 0,
                [TOKEN2.address]: 0,
                [ETH.address]: 0,
            }
        };

        // Deposit rewards
        for (const token of [TOKEN1, TOKEN2, ETH]) {
            const decimals = await token.decimals();
            for (let i = 0; i < accounts.length; i++) {
                for (const darknode of [darknode1, darknode2]) {
                    let fee = Math.floor(Math.random() * decimals);
                    await token.transfer(accounts[i], fee);

                    const value = token === ETH ? fee : 0;
                    await token.approve(darknodeRewardVault.address, fee, { from: accounts[i] });
                    await darknodeRewardVault.deposit(darknode, token.address, fee, { value, from: accounts[i] });
                    sum[darknode][token.address] += fee;
                }
            }
        }

        for (const token of [TOKEN1, TOKEN2, ETH]) {
            for (const darknode of [darknode1, darknode2]) {
                const balanceBefore = new BN(await token.balanceOf(darknodeOperator));
                await darknodeRewardVault.withdraw(darknode, token.address);
                const balanceAfter = new BN(await token.balanceOf(darknodeOperator));

                balanceAfter.should.bignumber.equal(balanceBefore.add(new BN(sum[darknode][token.address])));
            }
        }
    });

    it("checks that deposit amounts are valid", async () => {
        await darknodeRewardVault.deposit(darknode1, TOKEN1.address, 1)
            .should.be.rejectedWith(null, /revert/); // erc20 transfer error

        await darknodeRewardVault.deposit(darknode1, ETH.address, 1)
            .should.be.rejectedWith(null, /mismatched tx value/);
    });

    it("cannot deposit ether and erc20 with the same transaction", async () => {
        await TOKEN1.approve(darknodeRewardVault.address, 10);
        await darknodeRewardVault.deposit(
            darknode1, TOKEN1.address, 10, {value: 10})
            .should.be.rejectedWith(null, /unexpected ether transfer/);
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
