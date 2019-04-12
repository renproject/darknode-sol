import { BN } from "bn.js";

import {
    MINIMUM_BOND, PUBK, waitForEpoch, increaseTime, ETHEREUM_TOKEN_ADDRESS
} from "./helper/testUtils";


import { DarknodePaymentStoreArtifact, DarknodePaymentStoreContract } from "./bindings/darknode_payment_store";
import { DarknodeRegistryArtifact, DarknodeRegistryContract } from "./bindings/darknode_registry";
import { DarknodePaymentArtifact, DarknodePaymentContract } from "./bindings/darknode_payment";
import { ERC20Artifact, ERC20Contract } from "./bindings/erc20";
import { RepublicTokenArtifact, RepublicTokenContract } from "./bindings/republic_token";

import { DARKNODE_PAYMENT_CYCLE_DURATION } from "../migrations/config";

const RepublicToken = artifacts.require("RepublicToken") as RepublicTokenArtifact;
const ERC20 = artifacts.require("DAIToken") as ERC20Artifact;
const DarknodePaymentStore = artifacts.require("DarknodePaymentStore") as DarknodePaymentStoreArtifact;
const DarknodePayment = artifacts.require("DarknodePayment") as DarknodePaymentArtifact;
const DarknodeRegistry = artifacts.require("DarknodeRegistry") as DarknodeRegistryArtifact;

const hour = 60 * 60;
const day = 24 * hour;

const CYCLE_DURATION = DARKNODE_PAYMENT_CYCLE_DURATION * day;

contract("DarknodePayment", (accounts: string[]) => {

    let store: DarknodePaymentStoreContract;
    let dai: ERC20Contract;
    let erc20Token: ERC20Contract;
    let dnr: DarknodeRegistryContract;
    let dnp: DarknodePaymentContract;
    let ren: RepublicTokenContract;

    const owner = accounts[0];
    const darknode1 = accounts[1];
    const darknode2 = accounts[2];
    const darknode3 = accounts[3];
    const darknode4 = accounts[4];
    const darknode5 = accounts[5];

    before(async () => {
        ren = await RepublicToken.deployed();
        dai = await ERC20.deployed();
        erc20Token = await ERC20.new();
        dnr = await DarknodeRegistry.deployed();
        store = await DarknodePaymentStore.deployed();
        dnp = await DarknodePayment.deployed();

        // [ACTION] Register
        // Don't register a darknode under account[0]
        for (let i = 1; i < accounts.length; i++) {
            await ren.transfer(accounts[i], MINIMUM_BOND);
            await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[i] });
            // Register the darknodes under the account address
            await dnr.register(accounts[i], PUBK(i), { from: accounts[i] });
        }

        // Wait for two epochs for darknodes to be registered
        await waitForCycle(2 * day);

        new BN(await store.darknodeWhitelistLength()).should.bignumber.equal(new BN(0));
    });

    afterEach(async () => {
        await waitForCycle();
    });

    describe("Token registration", async() => {
        it("can register tokens", async() => {
            await dnp.registerToken(dai.address);
            await dnp.registerToken(dai.address).should.be.rejectedWith(null, /token already pending registration/);
            await dnp.registerToken(erc20Token.address).should.not.be.rejectedWith(null, /token already pending registration/);
            // complete token registration
            await waitForCycle();
            (await dnp.supportedTokens(0)).should.equal(dai.address);
            (await dnp.supportedTokenIndex(dai.address)).should.bignumber.equal(new BN(1));
        });

        it("cannot register already registered tokens", async() => {
            await dnp.registerToken(dai.address).should.be.rejectedWith(null, /token already registered/);
        });

        it("cannot deregister unregistered tokens", async() => {
            await dnp.deregisterToken(ETHEREUM_TOKEN_ADDRESS).should.be.rejectedWith(null, /token not registered/);
        });

        it("can deregister tokens", async() => {
            await dnp.registerToken(ETHEREUM_TOKEN_ADDRESS);
            // complete token registration
            await waitForCycle();
            (await dnp.supportedTokens(2)).should.equal(ETHEREUM_TOKEN_ADDRESS);
            (await dnp.supportedTokenIndex(ETHEREUM_TOKEN_ADDRESS)).should.bignumber.equal(3);
            await dnp.deregisterToken(ETHEREUM_TOKEN_ADDRESS);
            await dnp.deregisterToken(ETHEREUM_TOKEN_ADDRESS).should.be.rejectedWith(null, /token already pending deregistration/);
            await dnp.deregisterToken(erc20Token.address).should.not.be.rejectedWith(null, /token already pending deregistration/);
            // complete token deregistration
            await waitForCycle();
            (await dnp.supportedTokenIndex(ETHEREUM_TOKEN_ADDRESS)).should.bignumber.equal(0);
            (await dnp.supportedTokenIndex(erc20Token.address)).should.bignumber.equal(0);
        });
    });

    describe("Token deposits", async () => {

        it("can deposit ETH using deposit()", async () => {
            // deposit using deposit() function
            const previousReward = new BN(await dnp.currentCycleRewardPool(ETHEREUM_TOKEN_ADDRESS));
            const oldETHBalance = new BN(await store.totalBalance(ETHEREUM_TOKEN_ADDRESS));
            const amount = new BN("1000000000");
            await dnp.deposit(amount, ETHEREUM_TOKEN_ADDRESS, { value: amount.toString() }).should.not.be.rejected;
            new BN(await store.totalBalance(ETHEREUM_TOKEN_ADDRESS)).should.bignumber.equal(oldETHBalance.add(amount));
            // We should have increased the reward pool
            (new BN(await dnp.currentCycleRewardPool(ETHEREUM_TOKEN_ADDRESS))).should.bignumber.equal(previousReward.add(amount));
        });

        it("can deposit ETH via direct payment to DarknodePayment contract", async () => {
            // deposit using direct deposit to dnp
            const previousReward = new BN(await dnp.currentCycleRewardPool(ETHEREUM_TOKEN_ADDRESS));
            const oldETHBalance = new BN(await store.totalBalance(ETHEREUM_TOKEN_ADDRESS));
            const amount = new BN("1000000000");
            await web3.eth.sendTransaction({ to: dnp.address, from: owner, value: amount.toString() });
            new BN(await store.totalBalance(ETHEREUM_TOKEN_ADDRESS)).should.bignumber.equal(oldETHBalance.add(amount));
            // We should have increased the reward pool
            (new BN(await dnp.currentCycleRewardPool(ETHEREUM_TOKEN_ADDRESS))).should.bignumber.equal(previousReward.add(amount));
        });

        it("can deposit ETH via direct payment to DarknodePaymentStore contract", async () => {
            // deposit using direct deposit to store
            const previousReward = new BN(await dnp.currentCycleRewardPool(ETHEREUM_TOKEN_ADDRESS));
            const oldETHBalance = new BN(await store.totalBalance(ETHEREUM_TOKEN_ADDRESS));
            const amount = new BN("1000000000");
            await web3.eth.sendTransaction({ to: store.address, from: owner, value: amount.toString() });
            new BN(await store.totalBalance(ETHEREUM_TOKEN_ADDRESS)).should.bignumber.equal(oldETHBalance.add(amount));
            // We should have increased the reward pool
            (new BN(await dnp.currentCycleRewardPool(ETHEREUM_TOKEN_ADDRESS))).should.bignumber.equal(previousReward.add(amount));
        });

        it("cannot deposit ERC20 with ETH attached", async () => {
            const amount = new BN("100000000000000000");
            await dnp.deposit(amount, dai.address, { value: 1 }).should.be.rejectedWith(null, /unexpected ether transfer/);
        });
    });


    describe("Claiming rewards", async () => {
        it("cannot tick if not registered", async () => {
            await dnp.claim(accounts[0]).should.be.rejectedWith(null, /darknode is not registered/);
        })

        it("cannot withdraw if there is no balance", async () => {
            await dnp.withdraw(darknode1, dai.address).should.be.rejectedWith(null, /nothing to withdraw/);
        })

        it("can whitelist darknodes", async () => {
            await waitForCycle();
            new BN(await store.darknodeWhitelistLength()).should.bignumber.equal(new BN(0));
            await store.isWhitelisted(darknode1).should.eventually.be.false;
            await dnp.claim(darknode1);
            // Attempts to whitelist again during the same cycle should do nothing
            await dnp.claim(darknode1).should.be.rejectedWith(null, /cannot claim for this cycle/);
            await store.isWhitelisted(darknode1).should.eventually.be.true;
            await waitForCycle();
            new BN(await store.darknodeWhitelistLength()).should.bignumber.equal(new BN(1));
        })

        it("can be paid DAI from a payee", async () => {
            // darknode1 is whitelisted and can participate in rewards
            const previousBalance = new BN(await dnp.currentCycleRewardPool(dai.address));
            const amount = new BN("100000000000000000");
            await deposit(amount);

            // We should have increased the reward pool
            (new BN(await dnp.currentCycleRewardPool(dai.address))).should.bignumber.equal(previousBalance.add(amount));

            // We should have zero claimed balance before ticking
            (new BN(await store.darknodeBalances(darknode1, dai.address))).should.bignumber.equal(new BN(0));

            // We don't need to claim since we weren't allocated rewards last cycle
            // But claim shouldn't revert
            await dnp.claim(darknode1);
            await waitForCycle();

            // We should be the only one who participated last cycle
            (new BN(await dnp.shareSize())).should.bignumber.equal(1);
            // We should be allocated all the rewards
            (new BN(await dnp.unclaimedRewards(dai.address))).should.bignumber.equal(amount);
            (new BN(await dnp.previousCycleRewardShare(dai.address))).should.bignumber.equal(amount);

            // Claim the rewards for last cycle
            await dnp.claim(darknode1);
            await waitForCycle();
            // There should be nothing left in the reward pool
            (new BN(await dnp.currentCycleRewardPool(dai.address))).should.bignumber.equal(new BN(0));
            const darknode1Balance = new BN(await store.darknodeBalances(darknode1, dai.address));
            darknode1Balance.should.bignumber.equal(amount);
        });

        it("can be paid ETH from a payee", async () => {
            // register ETH
            await dnp.registerToken(ETHEREUM_TOKEN_ADDRESS);
            await waitForCycle();

            const previousReward = new BN(await dnp.currentCycleRewardPool(ETHEREUM_TOKEN_ADDRESS));
            const oldETHBalance = new BN(await store.totalBalance(ETHEREUM_TOKEN_ADDRESS));
            const amount = new BN("1000000000");
            await dnp.deposit(amount, ETHEREUM_TOKEN_ADDRESS).should.be.rejectedWith(null, /mismatched deposit value/);
            await dnp.deposit(amount, ETHEREUM_TOKEN_ADDRESS, { value: amount.toString() }).should.not.be.rejected;
            new BN(await store.totalBalance(ETHEREUM_TOKEN_ADDRESS)).should.bignumber.equal(oldETHBalance.add(amount));
            // We should have increased the reward pool
            const newReward = new BN(await dnp.currentCycleRewardPool(ETHEREUM_TOKEN_ADDRESS));
            newReward.should.bignumber.equal(previousReward.add(amount));

            // We should have zero claimed balance before ticking
            (new BN(await store.darknodeBalances(darknode1, ETHEREUM_TOKEN_ADDRESS))).should.bignumber.equal(new BN(0));

            // We don't need to claim since we weren't allocated rewards last cycle
            // But claim shouldn't revert
            await dnp.claim(darknode1);
            await waitForCycle();

            // We should be the only one who participated last cycle
            (new BN(await dnp.shareSize())).should.bignumber.equal(1);
            // We should be allocated all the rewards
            (new BN(await dnp.unclaimedRewards(ETHEREUM_TOKEN_ADDRESS))).should.bignumber.equal(newReward);
            (new BN(await dnp.previousCycleRewardShare(ETHEREUM_TOKEN_ADDRESS))).should.bignumber.equal(newReward);

            // Claim the rewards for last cycle
            await dnp.claim(darknode1);
            await waitForCycle();
            // There should be nothing left in the reward pool
            (new BN(await dnp.currentCycleRewardPool(ETHEREUM_TOKEN_ADDRESS))).should.bignumber.equal(new BN(0));
            const earnedRewards = new BN(await store.darknodeBalances(darknode1, ETHEREUM_TOKEN_ADDRESS));
            earnedRewards.should.bignumber.equal(newReward);

            const oldBalance = new BN(await web3.eth.getBalance(darknode1));
            await dnp.withdraw(darknode1, ETHEREUM_TOKEN_ADDRESS);

            // Our balances should have increased
            const newBalance = new BN(await web3.eth.getBalance(darknode1));
            newBalance.should.bignumber.equal(oldBalance.add(earnedRewards));

            // We should have nothing left to withdraw
            const postWithdrawRewards = new BN(await store.darknodeBalances(darknode1, ETHEREUM_TOKEN_ADDRESS));
            postWithdrawRewards.should.bignumber.equal(new BN(0));

            // Deregister ETH
            await dnp.deregisterToken(ETHEREUM_TOKEN_ADDRESS).should.not.be.rejectedWith(null, /token already pending deregistration/);
            await waitForCycle();
            (await dnp.supportedTokenIndex(ETHEREUM_TOKEN_ADDRESS)).should.bignumber.equal(0);
        });

        it("can pay out DAI when darknodes withdraw", async () => {
            const darknode1Balance = new BN(await store.darknodeBalances(darknode1, dai.address));
            darknode1Balance.gt(new BN(0)).should.be.true;
            await withdraw(darknode1);
        })

        it("cannot call tick twice in the same cycle", async () => {
            await dnp.claim(darknode1);
            await dnp.claim(darknode1).should.be.rejectedWith(null, /reward already claimed/);
        })

        it("can tick again after a cycle has passed", async () => {
            await dnp.claim(darknode1);
            await waitForCycle();
            await dnp.claim(darknode1).should.not.be.rejectedWith(null, /reward already claimed/);
        })

        it("should evenly split reward pool between ticked darknodes", async () => {
            const numDarknodes = 3;

            // Start from number 2 to avoid previous balances
            const startDarknode = 2;

            // Whitelist
            await multiTick(startDarknode, numDarknodes);
            // Change the epoch
            await waitForCycle();

            const rewards = new BN("300000000000000000");
            await deposit(rewards);

            // Participate in rewards
            await multiTick(startDarknode, numDarknodes);
            // Change the epoch
            await waitForCycle();

            // Claim rewards for past epoch
            await multiTick(startDarknode, numDarknodes);

            for (let i = startDarknode; i < startDarknode + numDarknodes; i++) {
                (new BN(await store.darknodeBalances(accounts[i], dai.address))).should.bignumber.equal(rewards.div(new BN(await dnp.shareSize())));
            }

            // Withdraw for each darknode
            await multiWithdraw(startDarknode, numDarknodes);

            // claim rewards for darknode1
            await tick(darknode1);
        });

        it("cannot withdraw if a darknode owner is invalid", async () => {
            // FIXME: test invalid darknode owner
            // await dnp.withdraw("0x0", dai.address).should.eventually.be.rejectedWith(null, /invalid darknode owner/);
            // accounts[0] is not a registered darknode
            // await dnp.withdraw(accounts[0], dai.address).should.eventually.be.rejectedWith(null, /invalid darknode owner/);
        })

        it("cannot withdraw more than once in a cycle", async () => {
            const numDarknodes = 4;
            new BN(await dnp.shareSize()).should.bignumber.equal(numDarknodes);

            const rewards = new BN("300000000000000000");
            await deposit(rewards);
            await multiTick(1, numDarknodes);
            // Change the epoch
            await waitForCycle();

            // Claim rewards for past cycle
            await multiTick(1, numDarknodes);

            // First withdraw should pass
            await withdraw(darknode1).should.not.be.rejectedWith(null, /nothing to withdraw/);

            // Rest should fail
            await dnp.withdraw(darknode1, dai.address).should.be.rejectedWith(null, /nothing to withdraw/);
            await dnp.withdraw(darknode1, dai.address).should.be.rejectedWith(null, /nothing to withdraw/);
        });

        it("cannot tick if it is blacklisted", async () => {
            // Should succeed if not blacklisted
            await tick(darknode2);

            await dnp.blacklist(darknode2);

            // Change the epoch
            await waitForCycle();

            // Tick should fail
            await tick(darknode2).should.be.rejectedWith(null, /darknode is blacklisted/);
        });

        it("can still withdraw allocated rewards when blacklisted", async () => {
            // Change the epoch
            await waitForCycle();
            // Change the epoch
            await waitForCycle();
            // Add rewards into the next cycle's pool
            (await store.isWhitelisted(darknode3)).should.be.true;
            const previousBalances = (new BN(await store.darknodeBalances(darknode3, dai.address)));

            const rewards = new BN("300000000000000000");
            await deposit(rewards);
            // Change the epoch
            await waitForCycle();

            // Claim the rewards for the pool
            await tick(darknode3);

            const rewardSplit = new BN(await dnp.shareSize());

            // Claim rewards for past cycle
            await dnp.blacklist(darknode3);

            const newBalances = (new BN(await store.darknodeBalances(darknode3, dai.address)));
            newBalances.should.bignumber.equal(previousBalances.add(rewards.div(rewardSplit)));

            withdraw(darknode3);
        });

    });

    it("should error when block number has not changed", async () => {
        // FIXME: Unimplemented
    })

    describe("Black/whitelisting of Darknodes", async () => {

        it("should revert if unauthorized to call blacklist or whitelist", async () => {
            await store.isBlacklisted(darknode1).should.eventually.be.false;
            await dnp.blacklist(darknode1, { from: accounts[2] }).should.be.rejectedWith(null, /not Blacklister/);
            await store.isBlacklisted(darknode1).should.eventually.be.false;
        })

        it("can update the blacklister address", async () => {
            await store.isBlacklisted(darknode4).should.eventually.be.false;
            await dnp.updateBlacklister(accounts[2]).should.be.not.rejectedWith(null, /invalid contract address/);
            await waitForCycle();
            await dnp.blacklist(darknode4, { from: accounts[2] }).should.not.be.rejectedWith(null, /not Blacklister/);
            await store.isBlacklisted(darknode4).should.eventually.be.true;
            await dnp.updateBlacklister(owner).should.be.not.rejectedWith(null, /invalid contract address/);
            await waitForCycle();
        })

        it("cannot update the blacklister address to an invalid address", async () => {
            await dnp.updateBlacklister("0x0").should.be.rejectedWith(null, /invalid contract address/);
        })

        it("cannot blacklist invalid addresses", async () => {
            const invalidAddress = "0x0"
            await store.isBlacklisted(invalidAddress).should.eventually.be.false;
            await dnp.blacklist(invalidAddress).should.be.rejectedWith(null, /darknode is not registered/);
            await store.isBlacklisted(owner).should.eventually.be.false;
            await dnp.blacklist(owner).should.be.rejectedWith(null, /darknode is not registered/);
        })

        it("should reject white/blacklist attempts from non-store contract", async () => {
            await store.isBlacklisted(darknode1).should.eventually.be.false;
            await dnp.blacklist(darknode1, { from: darknode1 }).should.be.rejectedWith(null, /not Blacklister/);
            await store.isBlacklisted(darknode1).should.eventually.be.false;
            await store.isWhitelisted(darknode5).should.eventually.be.false;
            await store.whitelist(darknode5, { from: darknode1 }).should.be.rejected;
            await store.isWhitelisted(darknode5).should.eventually.be.false;
        })

        it("can blacklist darknodes", async () => {
            await store.isBlacklisted(darknode5).should.eventually.be.false;
            await dnp.blacklist(darknode5);
            await store.isBlacklisted(darknode5).should.eventually.be.true;
        })

        it("cannot blacklist already blacklisted darknodes", async () => {
            await store.isBlacklisted(darknode5).should.eventually.be.true;
            await dnp.blacklist(darknode5).should.be.rejectedWith(null, /darknode already blacklisted/);
            await store.isBlacklisted(darknode5).should.eventually.be.true;
        })

        it("cannot whitelist blacklisted darknodes", async () => {
            await store.isBlacklisted(darknode5).should.eventually.be.true;
            await dnp.blacklist(darknode5).should.be.rejectedWith(null, /darknode already blacklisted/);
            await dnp.claim(darknode5).should.be.rejectedWith(null, /darknode is blacklisted/);
        });

    });

    it("cannot change cycle if insufficient time has passed", async () => {
        await waitForCycle(CYCLE_DURATION/2);
        await dnp.changeCycle().should.eventually.be.rejectedWith(null, /cannot cycle yet: too early/);
    });

    it("can change cycle duration", async () => {
        // Set the duration to 3 days
        await changeCycleDuration(3);
        // Set the duration to 0 days
        await changeCycleDuration(0);
        // Reset the duration back to normal
        await changeCycleDuration(DARKNODE_PAYMENT_CYCLE_DURATION);
    });

    it("can transfer ownership of the darknode payment store", async () => {
        // [ACTION] Initiate ownership transfer to wrong account
        await dnp.transferStoreOwnership(accounts[1]);

        // [ACTION] Can correct ownership transfer
        await dnp.transferStoreOwnership(owner);

        // [CHECK] Owner should still be dnp
        (await store.owner()).should.equal(dnp.address);

        // [ACTION] Claim ownership
        await store.claimOwnership();

        // [CHECK] Owner should now be main account
        (await store.owner()).should.equal(owner);

        // [RESET] Initiate ownership transfer back to dnp
        await store.transferOwnership(dnp.address);

        // [CHECK] Owner should still be main account
        (await store.owner()).should.equal(owner);

        // [RESET] Claim ownership
        await dnp.claimStoreOwnership();

        // [CHECK] Owner should now be the dnp
        (await store.owner()).should.equal(dnp.address);
    });

    describe("DarknodePaymentStore negative tests", async () => {
        // Transfer the ownership to owner
        before(async () => {
            // [ACTION] Can correct ownership transfer
            await dnp.transferStoreOwnership(owner);
            // [ACTION] Claim ownership
            await store.claimOwnership();
            // [CHECK] Owner should now be main account
            (await store.owner()).should.equal(owner);
        });

        it("cannot whitelist blacklisted darknodes", async () => {
            await store.isBlacklisted(darknode5).should.eventually.be.true;
            await store.whitelist(darknode5).should.eventually.be.rejectedWith(null, /darknode is blacklisted/);
        });

        it("cannot whitelist already whitelisted darknodes", async () => {
            await store.isWhitelisted(darknode1).should.eventually.be.true;
            await store.whitelist(darknode1).should.eventually.be.rejectedWith(null, /darknode already whitelisted/);
        })

        it("cannot increment balances by an invalid amounts", async () => {
            await store.incrementDarknodeBalance(darknode1, dai.address, 0).should.eventually.be.rejectedWith(null, /invalid amount/);
            const invalidAmount = new BN(await store.availableBalance(dai.address)).add(new BN(1));
            await store.incrementDarknodeBalance(darknode1, dai.address, invalidAmount).should.eventually.be.rejectedWith(null, /insufficient contract balance/);
        })

        it("cannot transfer more than is in the balance", async () => {
            const invalidAmount = new BN(await store.darknodeBalances(darknode1, dai.address)).add(new BN(1));
            await store.transfer(darknode1, dai.address, invalidAmount, darknode1).should.eventually.be.rejectedWith(null, /insufficient darknode balance/);
        })

        // Transfer the ownership back to DNP
        after(async () => {
            // [RESET] Initiate ownership transfer back to dnp
            await store.transferOwnership(dnp.address);
            // [RESET] Claim ownership
            await dnp.claimStoreOwnership();
            // [CHECK] Owner should now be the dnp
            (await store.owner()).should.equal(dnp.address);
        });
    });

    const tick = async (address) => {
        return dnp.claim(address);
    }

    const multiTick = async (start=1, numberOfDarknodes=1) => {
        for (let i = start; i < start + numberOfDarknodes; i++) {
            await tick(accounts[i]);
        }
    }

    const withdraw = async (address) => {
        // Our claimed amount should be positive
        const earnedDAIRewards = new BN(await store.darknodeBalances(address, dai.address));
        earnedDAIRewards.gt(new BN(0)).should.be.true;

        const oldDAIBalance = new BN(await dai.balanceOf(address));

        await dnp.withdraw(address, dai.address);

        // Our balances should have increased
        const newDAIBalance = new BN(await dai.balanceOf(address));
        newDAIBalance.should.bignumber.equal(oldDAIBalance.add(earnedDAIRewards));

        // We should have nothing left to withdraw
        const postWithdrawRewards = new BN(await store.darknodeBalances(address, dai.address));
        postWithdrawRewards.should.bignumber.equal(new BN(0));
    }

    const multiWithdraw = async (start=1, numberOfDarknodes=1) => {
        for (let i = start; i < start + numberOfDarknodes; i++) {
            await withdraw(accounts[i]);
        }
    }

    const deposit = async (amount) => {
        const amountBN = new BN(amount);
        const previousBalance = new BN(await dnp.currentCycleRewardPool(dai.address));
        // Approve the contract to use DAI
        await dai.approve(dnp.address, amountBN);
        await dnp.deposit(amountBN, dai.address);
        // We should expect the DAI balance to have increased by what we deposited
        (await dnp.currentCycleRewardPool(dai.address)).should.bignumber.equal(previousBalance.add(amountBN));
    }

    const changeCycleDuration = async (timeInDays: number) => {
        const timeInSecs = timeInDays * day;
        const currentCycleDurationInSecs = new BN(await dnp.cycleDuration()).toNumber();
        // console.log(currentCycleDurationInSecs.toString());

        await dnp.updateCycleDuration(timeInDays);
        (await dnp.cycleDuration()).should.bignumber.equal(timeInSecs);

        // put into effect the new cycle duration
        await increaseTime(currentCycleDurationInSecs);
        await dnp.changeCycle().should.not.eventually.be.rejectedWith(null, /cannot cycle yet: too early/);
        if (timeInSecs == 0) {
            await dnp.changeCycle().should.not.eventually.be.rejectedWith(null, /cannot cycle yet: too early/);
            return;
        }

        await dnp.changeCycle().should.eventually.be.rejectedWith(null, /cannot cycle yet: too early/);

        if (timeInSecs < currentCycleDurationInSecs) {
            await increaseTime(timeInSecs);
            await dnp.changeCycle().should.not.eventually.be.rejected; // With(null, /cannot cycle yet: too early/);
        } else {
            await increaseTime(currentCycleDurationInSecs);
            await dnp.changeCycle().should.eventually.be.rejected; //With(null, /cannot cycle yet: too early/);
            await increaseTime(timeInSecs - currentCycleDurationInSecs);
            await dnp.changeCycle().should.not.eventually.be.rejected; // With(null, /cannot cycle yet: too early/);
        }
    }

    const waitForCycle = async (seconds?) => {
        if (!seconds) {
            seconds = new BN(await dnp.cycleDuration()).toNumber();
        }
        const numEpochs = Math.floor(seconds / (1 * day));
        await increaseTime(seconds);
        for (let i = 0; i < numEpochs; i++) {
            await waitForEpoch(dnr);
        }
        if (seconds >= CYCLE_DURATION) {
            await dnp.changeCycle();
        }
    }

});
