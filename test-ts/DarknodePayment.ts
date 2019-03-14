import { BN } from "bn.js";

import {
    MINIMUM_BOND, PUBK, waitForEpoch,
} from "./helper/testUtils";


import { DarknodePaymentArtifact, DarknodePaymentContract } from "./bindings/darknode_payment";
import { DarknodeRegistryArtifact, DarknodeRegistryContract } from "./bindings/darknode_registry";
import { ERC20Artifact, ERC20Contract } from "./bindings/erc20";
import { RepublicTokenArtifact, RepublicTokenContract } from "./bindings/republic_token";

const RepublicToken = artifacts.require("RepublicToken") as RepublicTokenArtifact;
const ERC20 = artifacts.require("DAIToken") as ERC20Artifact;
const DarknodePayment = artifacts.require("DarknodePayment") as DarknodePaymentArtifact;
const DarknodeRegistry = artifacts.require("DarknodeRegistry") as DarknodeRegistryArtifact;

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

        // Wait for epochs
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);
    });

    afterEach(async () => {
        // Call an epoch to reset tick status
        await waitForEpoch(dnr);
    });

    it("can be paid DAI from a payee", async () => {
        const previousBalance = new BN(await dnp.currentEpochRewardPool());
        previousBalance.should.bignumber.equal(new BN(0));

        // Approve the contract to use DAI
        const amount = new BN("100000000000000000");
        await dai.approve(dnp.address, amount);
        await dnp.deposit(amount);
        const newRewardPool = previousBalance.add(amount);
        // We should expect the DAI balance to have increased by what we deposited
        (await dnp.currentEpochRewardPool()).should.bignumber.equal(newRewardPool);
    });

    it("cannot withdraw if there is no balance", async () => {
        await dnp.withdraw({ from: darknode1 }).should.be.rejectedWith(null, /nothing to withdraw/);
    })

    it("cannot call tick twice in the same epoch", async () => {
        await dnp.tick({ from: darknode1 });
        await dnp.tick({ from: darknode1 }).should.be.rejectedWith(null, /already ticked/);
    })

    it("can tick again after an epoch has passed", async () => {
        await dnp.tick({ from: darknode1 });
        await waitForEpoch(dnr);
        await dnp.tick({ from: darknode1 }).should.not.be.rejectedWith(null, /already ticked/);
    })

    it("can withdraw DAI out of contract", async () => {
        const oldDAIBalance = new BN(await dai.balanceOf(darknode1));

        // Tick twice to allocate rewards
        await dnp.tick({ from: darknode1 });
        await waitForEpoch(dnr);
        await dnp.tick({ from: darknode1 });

        const earnedDAIRewards = new BN(await dnp.darknodeBalances(darknode1));
        await dnp.withdraw({ from: darknode1 });

        // Our balances should have increased
        const newDAIBalance = new BN(await dai.balanceOf(darknode1));
        newDAIBalance.should.bignumber.equal(oldDAIBalance.add(earnedDAIRewards));

        // We should have nothing left to withdraw
        const postWithdrawRewards = new BN(await dnp.darknodeBalances(darknode1));
        postWithdrawRewards.should.bignumber.equal(new BN(0));
    })

});
