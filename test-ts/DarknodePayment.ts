import { BN } from "bn.js";

import {
    MINIMUM_BOND, PUBK, waitForEpoch, increaseTime,
} from "./helper/testUtils";


import { DarknodePaymentArtifact, DarknodePaymentContract } from "./bindings/darknode_payment";
import { DarknodeRegistryArtifact, DarknodeRegistryContract } from "./bindings/darknode_registry";
import { ERC20Artifact, ERC20Contract } from "./bindings/erc20";
import { RepublicTokenArtifact, RepublicTokenContract } from "./bindings/republic_token";

import { DARKNODE_PAYMENT_CYCLE_DURATION } from "../migrations/config";

const RepublicToken = artifacts.require("RepublicToken") as RepublicTokenArtifact;
const ERC20 = artifacts.require("DAIToken") as ERC20Artifact;
const DarknodePayment = artifacts.require("DarknodePayment") as DarknodePaymentArtifact;
const DarknodeRegistry = artifacts.require("DarknodeRegistry") as DarknodeRegistryArtifact;

const hour = 60 * 60;
const day = 24 * hour;

const CYCLE_DURATION = DARKNODE_PAYMENT_CYCLE_DURATION * day;

contract("DarknodePayment", (accounts: string[]) => {

    let dnp: DarknodePaymentContract;
    let dai: ERC20Contract;
    let dnr: DarknodeRegistryContract;
    let ren: RepublicTokenContract;

    const darknode1 = accounts[1];

    before(async () => {
        ren = await RepublicToken.deployed();
        dai = await ERC20.deployed();
        dnr = await DarknodeRegistry.deployed();
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
    });

    it("cannot deposit with ETH attached", async () => {
        const amount = new BN("100000000000000000");
        await dnp.deposit(amount, { value: 1 }).should.be.rejectedWith(null, /unexpected ether transfer/);
    })

    it("cannot tick if not registered", async () => {
        await dnp.tick().should.be.rejectedWith(null, /not a registered darknode/);
    })

    it("cannot withdraw if there is no balance", async () => {
        await dnp.withdraw({ from: darknode1 }).should.be.rejectedWith(null, /nothing to withdraw/);
    })

    it("can be paid DAI from a payee", async () => {
        const previousBalance = new BN(await dnp.currentCycleRewardPool());
        previousBalance.should.bignumber.equal(new BN(0));
        await deposit("100000000000000000");
    });

    it("can withdraw DAI out of contract", async () => {
        // There should be a positive amount in the reward pool
        (new BN(await dnp.currentCycleRewardPool()).gt(new BN(0))).should.be.true;

        // We should have zero claimed balance before ticking
        (new BN(await dnp.darknodeBalances(darknode1))).should.bignumber.equal(new BN(0));

        // Tick twice to allocate rewards
        await tick(darknode1);
        await waitForCycle();

        // There should be nothing left in the reward pool
        (new BN(await dnp.currentCycleRewardPool())).should.bignumber.equal(new BN(0));

        await tick(darknode1);

        await withdraw(darknode1);
    })

    it("cannot call tick twice in the same cycle", async () => {
        await tick(darknode1);
        await tick(darknode1).should.be.rejectedWith(null, /already ticked/);
    })

    it("can tick again after a cycle has passed", async () => {
        await tick(darknode1);
        await waitForCycle();
        await tick(darknode1).should.not.be.rejectedWith(null, /already ticked/);
    })

    it("should evenly split reward pool between ticked darknodes", async () => {
        const rewards = new BN("300000000000000000");
        const numDarknodes = 3;

        // Start from number 2 to avoid previous balances
        const startDarknode = 2;
        await deposit(rewards);

        await multiTick(startDarknode, numDarknodes);
        // Change the epoch
        await waitForCycle();

        // Claim rewards for past epoch
        await multiTick(startDarknode, numDarknodes);

        for (let i = startDarknode; i < startDarknode + numDarknodes; i++) {
            (new BN(await dnp.darknodeBalances(accounts[i]))).should.bignumber.equal(rewards.div(new BN(numDarknodes)));
        }

        // Withdraw for each darknode
        await multiWithdraw(startDarknode, numDarknodes);
    });

    it("cannot withdraw more than once in a cycle", async () => {
        const rewards = new BN("300000000000000000");
        await deposit(rewards);
        await tick(darknode1);
        // Change the epoch
        await waitForCycle();

        // Claim rewards for past cycle
        await tick(darknode1);

        // First withdraw should pass
        await withdraw(darknode1).should.not.be.rejectedWith(null, /nothing to withdraw/);

        // Rest should fail
        await dnp.withdraw({ from: darknode1 }).should.be.rejectedWith(null, /nothing to withdraw/);
        await dnp.withdraw({ from: darknode1 }).should.be.rejectedWith(null, /nothing to withdraw/);
    });

    const tick = async (address) => {
        return dnp.fetchAndUpdateCurrentCycle().then(() => dnp.tick({ from: address }));
    }

    const multiTick = async (start=1, numberOfDarknodes=1) => {
        for (let i = start; i < start + numberOfDarknodes; i++) {
            await tick(accounts[i]);
        }
    }

    const withdraw = async (address) => {
        // Our claimed amount should be positive
        const earnedDAIRewards = new BN(await dnp.darknodeBalances(address));
        earnedDAIRewards.gt(new BN(0)).should.be.true;

        const oldDAIBalance = new BN(await dai.balanceOf(address));

        await dnp.withdraw({ from: address });

        // Our balances should have increased
        const newDAIBalance = new BN(await dai.balanceOf(address));
        newDAIBalance.should.bignumber.equal(oldDAIBalance.add(earnedDAIRewards));

        // We should have nothing left to withdraw
        const postWithdrawRewards = new BN(await dnp.darknodeBalances(address));
        postWithdrawRewards.should.bignumber.equal(new BN(0));
    }

    const multiWithdraw = async (start=1, numberOfDarknodes=1) => {
        for (let i = start; i < start + numberOfDarknodes; i++) {
            await withdraw(accounts[i]);
        }
    }

    const deposit = async (amount) => {
        const amountBN = new BN(amount);
        const previousBalance = new BN(await dnp.currentCycleRewardPool());
        // Approve the contract to use DAI
        await dai.approve(dnp.address, amountBN);
        await dnp.deposit(amountBN);
        // We should expect the DAI balance to have increased by what we deposited
        (await dnp.currentCycleRewardPool()).should.bignumber.equal(previousBalance.add(amountBN));
    }

    const waitForCycle = async (seconds=CYCLE_DURATION) => {
        const numEpochs = Math.floor(seconds / (1 * day));
        await increaseTime(seconds);
        for (let i = 0; i < numEpochs; i++) {
            await waitForEpoch(dnr);
        }
        await dnp.fetchAndUpdateCurrentCycle();
    }

});
