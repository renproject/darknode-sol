import { BN } from "bn.js";

import {
    MINIMUM_BOND, PUBK, waitForEpoch, increaseTime,
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

contract("DarknodePaymentStore", (accounts: string[]) => {

    let store: DarknodePaymentStoreContract;
    let dai: ERC20Contract;
    let dnr: DarknodeRegistryContract;
    let dnp: DarknodePaymentContract;
    let ren: RepublicTokenContract;

    const darknode1 = accounts[1];
    const darknode2 = accounts[2];
    const darknode3 = accounts[3];

    before(async () => {
        ren = await RepublicToken.deployed();
        dai = await ERC20.deployed();
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
        await waitForCycle(2 * day)
    });

    afterEach(async () => {
        // Call a new cycle to reset tick status
        await waitForCycle();
        // Call a new cycle to reset tick status
        await waitForCycle();
    });

    it("can register tokens", async() => {
        await dnp.registerToken(dai.address);
        // complete token registration
        await waitForCycle();
        (await dnp.supportedTokens(0)).should.equal(dai.address);
        (await dnp.supportedTokenIndex(dai.address)).should.bignumber.equal(new BN(1));
    });


    it("cannot deposit with ETH attached", async () => {
        const amount = new BN("100000000000000000");
        await dnp.deposit(amount, dai.address, { value: 1 }).should.be.rejectedWith(null, /unexpected ether transfer/);
    })

    it("cannot tick if not registered", async () => {
        await dnp.claim(accounts[0]).should.be.rejectedWith(null, /not a registered darknode/);
    })

    it("cannot withdraw if there is no balance", async () => {
        await dnp.withdraw(darknode1, dai.address).should.be.rejectedWith(null, /nothing to withdraw/);
    })

    it("can be paid DAI from a payee", async () => {
        const previousBalance = new BN(await dnp.unclaimedRewards(dai.address));
        previousBalance.should.bignumber.equal(new BN(0));
        const amount = new BN("100000000000000000");
        await deposit(amount);
        // There should be a positive amount in the reward pool
        (new BN(await dnp.currentCycleRewardPool(dai.address)).gt(new BN(0))).should.be.true;

        // We should have zero claimed balance before ticking
        (new BN(await store.darknodeBalance(darknode1, dai.address))).should.bignumber.equal(new BN(0));

        // Tick once to whitelist
        await dnp.claim(darknode1);
        // Attempts to whitelist again during the same cycle should do nothing
        await dnp.claim(darknode1);
        await waitForCycle();

        // Tick a second time to participate in rewards
        await dnp.claim(darknode1);
        await waitForCycle();

        // Tick a third time to claim rewards
        await dnp.claim(darknode1);
        await waitForCycle();
        // There should be nothing left in the reward pool
        (new BN(await dnp.currentCycleRewardPool(dai.address))).should.bignumber.equal(new BN(0));
        const darknode1Balance = new BN(await store.darknodeBalance(darknode1, dai.address));
        darknode1Balance.should.bignumber.equal(amount);
    });

    it("can pay out DAI when darknodes withdraw", async () => {
        const darknode1Balance = new BN(await store.darknodeBalance(darknode1, dai.address));
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
            (new BN(await store.darknodeBalance(accounts[i], dai.address))).should.bignumber.equal(rewards.div(new BN(await dnp.shareSize())));
        }

        // Withdraw for each darknode
        await multiWithdraw(startDarknode, numDarknodes);

        // claim rewards for darknode1
        await tick(darknode1);
    });

    it("cannot withdraw if a darknode owner is invalid", async () => {
        await dnp.withdraw("0x0", dai.address).should.eventually.be.rejectedWith(null, /invalid darknode owner/);
        // accounts[0] is not a registered darknode
        await dnp.withdraw(accounts[0], dai.address).should.eventually.be.rejectedWith(null, /invalid darknode owner/);
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

    it("can still claim previous cycle rewards when blacklisted", async () => {
        // Change the epoch
        await waitForCycle();
        // Change the epoch
        await waitForCycle();
        // Add rewards into the next cycle's pool
        (await store.isWhitelisted(darknode3)).should.be.true;
        const previousBalances = (new BN(await store.darknodeBalance(darknode3, dai.address)));

        const rewards = new BN("300000000000000000");
        await deposit(rewards);
        // Change the epoch
        await waitForCycle();

        // Claim the rewards for the pool
        await tick(darknode3);

        const rewardSplit = new BN(await dnp.shareSize());

        // Claim rewards for past cycle
        await dnp.blacklist(darknode3);

        const newBalances = (new BN(await store.darknodeBalance(darknode3, dai.address)));
        newBalances.should.bignumber.equal(previousBalances.add(rewards.div(rewardSplit)));
    });

    it("should error when epoch hasn't changed but time has passed", async () => {
        await increaseTime(CYCLE_DURATION);
        await dnp.changeCycle().should.be.rejectedWith(null, /no new epoch/);
    })

    it("should revert if unauthorized to call blacklist or whitelist", async () => {
        await store.isBlacklisted(darknode1).should.eventually.be.false;
        await dnp.blacklist(darknode1, { from: accounts[2] }).should.be.rejectedWith(null, /not DarknodeJudge/);
        await store.isBlacklisted(darknode1).should.eventually.be.false;
    })

    it("can update the jury address", async () => {
        await store.isBlacklisted(darknode1).should.eventually.be.false;
        await dnp.updateDarknodeJudge(accounts[2]).should.be.not.rejectedWith(null, /invalid contract address/);
        await waitForCycle();
        await dnp.blacklist(darknode1, { from: accounts[2] }).should.not.be.rejectedWith(null, /not DarknodeJudge/);
        await store.isBlacklisted(darknode1).should.eventually.be.true;
    })

    it("cannot update the jury address to an invalid address", async () => {
        await dnp.updateDarknodeJudge("0x0").should.be.rejectedWith(null, /invalid contract address/);
    })

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
        const earnedDAIRewards = new BN(await store.darknodeBalance(address, dai.address));
        earnedDAIRewards.gt(new BN(0)).should.be.true;

        const oldDAIBalance = new BN(await dai.balanceOf(address));

        await dnp.withdraw(address, dai.address);

        // Our balances should have increased
        const newDAIBalance = new BN(await dai.balanceOf(address));
        newDAIBalance.should.bignumber.equal(oldDAIBalance.add(earnedDAIRewards));

        // We should have nothing left to withdraw
        const postWithdrawRewards = new BN(await store.darknodeBalance(address, dai.address));
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

    const waitForCycle = async (seconds=CYCLE_DURATION) => {
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
