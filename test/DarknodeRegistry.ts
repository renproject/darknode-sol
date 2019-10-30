import BN from "bn.js";

import {
    DarknodeRegistryInstance, DarknodeRegistryStoreInstance, DarknodeSlasherInstance,
    RenTokenInstance,
} from "../types/truffle-contracts";
import {
    ID, MINIMUM_BOND, MINIMUM_EPOCH_INTERVAL_SECONDS, MINIMUM_POD_SIZE, NULL, PUBK, waitForEpoch,
} from "./helper/testUtils";

const RenToken = artifacts.require("RenToken");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");

const { config } = require("../migrations/networks");

contract("DarknodeRegistry", (accounts: string[]) => {

    let ren: RenTokenInstance;
    let dnrs: DarknodeRegistryStoreInstance;
    let dnr: DarknodeRegistryInstance;
    let slasher: DarknodeSlasherInstance;

    before(async () => {
        ren = await RenToken.deployed();
        dnrs = await DarknodeRegistryStore.deployed();
        dnr = await DarknodeRegistry.deployed();
        slasher = await DarknodeSlasher.deployed();
        await dnr.updateSlasher(slasher.address);
        await dnr.epoch({ from: accounts[1] }).should.be.rejectedWith(/not authorized/);
        await waitForEpoch(dnr);

        for (let i = 1; i < accounts.length; i++) {
            await ren.transfer(accounts[i], MINIMUM_BOND);
        }
    });

    it("should return empty list when no darknodes are registered", async () => {
        const nodes = (await dnr.getPreviousDarknodes.call(NULL, 100)).filter((x) => x !== NULL);
        (nodes.length).should.equal(0);
    });

    it("can update minimum bond", async () => {
        await dnr.updateMinimumBond(0x1);
        await waitForEpoch(dnr);
        (await dnr.minimumBond.call()).should.bignumber.equal(1);
        await dnr.updateMinimumBond(MINIMUM_BOND, { from: accounts[1] })
            .should.be.rejectedWith(/revert/); // not owner
        await dnr.updateMinimumBond(MINIMUM_BOND);
        (await dnr.minimumBond.call()).should.bignumber.equal(1);
        await waitForEpoch(dnr);
        (await dnr.minimumBond.call()).should.bignumber.equal(MINIMUM_BOND);
    });

    it("can update minimum pod size", async () => {
        await dnr.updateMinimumPodSize(0x0);
        await waitForEpoch(dnr);
        (await dnr.minimumPodSize.call()).should.bignumber.equal(0);
        await dnr.updateMinimumPodSize(MINIMUM_POD_SIZE, { from: accounts[1] })
            .should.be.rejectedWith(/revert/); // not owner
        await dnr.updateMinimumPodSize(MINIMUM_POD_SIZE);
        (await dnr.minimumPodSize.call()).should.bignumber.equal(0);
        await waitForEpoch(dnr);
        (await dnr.minimumPodSize.call()).should.bignumber.equal(MINIMUM_POD_SIZE);
    });

    it("can update minimum epoch interval", async () => {
        await dnr.updateMinimumEpochInterval(0x0);
        await waitForEpoch(dnr);
        (await dnr.minimumEpochInterval.call()).should.bignumber.equal(0);
        await dnr.updateMinimumEpochInterval(MINIMUM_EPOCH_INTERVAL_SECONDS, { from: accounts[1] })
            .should.be.rejectedWith(/revert/); // not owner
        await dnr.updateMinimumEpochInterval(MINIMUM_EPOCH_INTERVAL_SECONDS);
        (await dnr.minimumEpochInterval.call()).should.bignumber.equal(0);
        await waitForEpoch(dnr);
        (await dnr.minimumEpochInterval.call()).should.bignumber.equal(MINIMUM_EPOCH_INTERVAL_SECONDS);
    });

    it("can not register a Dark Node with a bond less than the minimum bond", async () => {
        const lowBond = MINIMUM_BOND.sub(new BN(1));
        await ren.approve(dnr.address, lowBond, { from: accounts[0] });
        await dnr.register(ID("A"), PUBK("A")).should.be.rejectedWith(/revert/); // failed transfer
    });

    it("can not call epoch before the minimum time interval", async () => {
        await waitForEpoch(dnr);
        // TODO: Why isn't reason returned?
        await dnr.epoch().should.be.rejectedWith(/revert/);
    });

    it("can register, deregister and refund Darknodes", async () => {
        // [ACTION] Register
        for (let i = 0; i < accounts.length; i++) {
            await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[i] });
            await dnr.register(ID(i), PUBK(i), { from: accounts[i] });
        }

        // Wait for epoch
        await waitForEpoch(dnr);

        // [ACTION] Deregister
        for (let i = 0; i < accounts.length; i++) {
            await dnr.deregister(ID(i), { from: accounts[i] });
        }

        // Wait for two epochs
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);

        // [ACTION] Refund
        for (let i = 0; i < accounts.length; i++) {
            await dnr.refund(ID(i), { from: accounts[i] });
        }
    });

    it("can check darknode statuses", async () => {
        // WARNING: A lot of code a head

        const owner = accounts[2];
        const id = ID("0");
        const pubk = PUBK("0");

        // [SETUP] Wait for epoch to reset `isRegisteredInPreviousEpoch`
        await waitForEpoch(dnr);

        // [CHECK]
        (await dnr.isRefunded.call(id))
            .should.be.true;
        (await dnr.isPendingRegistration.call(id)).should.be.false;
        (await dnr.isRegistered.call(id)).should.be.false;
        (await dnr.isDeregisterable.call(id)).should.be.false;
        (await dnr.isPendingDeregistration.call(id)).should.be.false;
        (await dnr.isDeregistered.call(id)).should.be.false;
        (await dnr.isRefundable.call(id)).should.be.false;
        (await dnr.isRegisteredInPreviousEpoch.call(id)).should.be.false;

        // [ACTION] Register
        await ren.approve(dnr.address, MINIMUM_BOND, { from: owner });
        await dnr.register(id, pubk, { from: owner });

        // [CHECK]
        (await dnr.isRefunded.call(id)).should.be.false;
        (await dnr.isPendingRegistration.call(id))
            .should.be.true;
        (await dnr.isRegistered.call(id)).should.be.false;
        (await dnr.isDeregisterable.call(id)).should.be.false;
        (await dnr.isPendingDeregistration.call(id)).should.be.false;
        (await dnr.isDeregistered.call(id)).should.be.false;
        (await dnr.isRefundable.call(id)).should.be.false;
        (await dnr.isRegisteredInPreviousEpoch.call(id)).should.be.false;

        await waitForEpoch(dnr);

        // [CHECK]
        (await dnr.isRefunded.call(id)).should.be.false;
        (await dnr.isPendingRegistration.call(id)).should.be.false;
        (await dnr.isRegistered.call(id))
            .should.be.true;
        (await dnr.isDeregisterable.call(id))
            .should.be.true;
        (await dnr.isPendingDeregistration.call(id)).should.be.false;
        (await dnr.isDeregistered.call(id)).should.be.false;
        (await dnr.isRefundable.call(id)).should.be.false;
        (await dnr.isRegisteredInPreviousEpoch.call(id)).should.be.false;

        await waitForEpoch(dnr);

        // [CHECK]
        (await dnr.isRefunded.call(id)).should.be.false;
        (await dnr.isPendingRegistration.call(id)).should.be.false;
        (await dnr.isRegistered.call(id))
            .should.be.true;
        (await dnr.isDeregisterable.call(id))
            .should.be.true;
        (await dnr.isPendingDeregistration.call(id)).should.be.false;
        (await dnr.isDeregistered.call(id)).should.be.false;
        (await dnr.isRefundable.call(id)).should.be.false;
        (await dnr.isRegisteredInPreviousEpoch.call(id))
            .should.be.true;

        // [ACTION] Deregister
        await dnr.deregister(id, { from: owner });

        // [CHECK]
        (await dnr.isRefunded.call(id)).should.be.false;
        (await dnr.isPendingRegistration.call(id)).should.be.false;
        (await dnr.isRegistered.call(id))
            .should.be.true;
        (await dnr.isDeregisterable.call(id)).should.be.false;
        (await dnr.isPendingDeregistration.call(id))
            .should.be.true;
        (await dnr.isDeregistered.call(id)).should.be.false;
        (await dnr.isRefundable.call(id)).should.be.false;
        (await dnr.isRegisteredInPreviousEpoch.call(id))
            .should.be.true;

        // [ACTION] Wait for epoch
        await waitForEpoch(dnr);

        (await dnr.isRefunded.call(id)).should.be.false;
        (await dnr.isPendingRegistration.call(id)).should.be.false;
        (await dnr.isRegistered.call(id)).should.be.false;
        (await dnr.isDeregisterable.call(id)).should.be.false;
        (await dnr.isPendingDeregistration.call(id)).should.be.false;
        (await dnr.isDeregistered.call(id))
            .should.be.true;
        (await dnr.isRefundable.call(id)).should.be.false;
        (await dnr.isRegisteredInPreviousEpoch.call(id))
            .should.be.true;

        // [ACTION] Wait for epoch
        await waitForEpoch(dnr);

        (await dnr.isRefunded.call(id)).should.be.false;
        (await dnr.isPendingRegistration.call(id)).should.be.false;
        (await dnr.isRegistered.call(id)).should.be.false;
        (await dnr.isDeregisterable.call(id)).should.be.false;
        (await dnr.isPendingDeregistration.call(id)).should.be.false;
        (await dnr.isDeregistered.call(id))
            .should.be.true;
        (await dnr.isRefundable.call(id))
            .should.be.true;
        (await dnr.isRegisteredInPreviousEpoch.call(id)).should.be.false;

        // [ACTION] Refund
        await dnr.refund(id, { from: accounts[0] });

        (await dnr.isRefunded.call(id))
            .should.be.true;
        (await dnr.isPendingRegistration.call(id)).should.be.false;
        (await dnr.isRegistered.call(id)).should.be.false;
        (await dnr.isDeregisterable.call(id)).should.be.false;
        (await dnr.isPendingDeregistration.call(id)).should.be.false;
        (await dnr.isDeregistered.call(id)).should.be.false;
        (await dnr.isRefundable.call(id)).should.be.false;
        (await dnr.isRegisteredInPreviousEpoch.call(id)).should.be.false;
    });

    it("bond is exactly the minimum bond", async () => {
        const owner = accounts[2];
        const id = ID("0");
        const pubk = PUBK("0");

        const renBalanceBefore = new BN(await ren.balanceOf.call(owner));

        // Approve more than minimum bond
        await ren.approve(dnr.address, MINIMUM_BOND.mul(new BN(2)), { from: owner });

        // Register
        await dnr.register(id, pubk, { from: owner });

        // Only minimum bond should have been transferred
        (await ren.balanceOf.call(owner)).should.bignumber.equal(renBalanceBefore.sub(MINIMUM_BOND));

        // [RESET]
        await waitForEpoch(dnr);
        await dnr.deregister(id, { from: owner });
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);
        await dnr.refund(id, { from: owner });
    });

    it("[SETUP] Register darknodes for next tests", async () => {
        for (let i = 0; i < accounts.length; i++) {
            await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[i] });
            await dnr.register(ID(i), PUBK(i), { from: accounts[i] });
        }
        await waitForEpoch(dnr);
    });

    it("can not register a node twice", async () => {
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[0] });
        await dnr.register(ID("0"), PUBK("0"))
            .should.be.rejectedWith(/must be refunded or never registered/);
    });

    it("can not deregister a node which is not registered", async () => {
        await dnr.deregister(ID("-1")).should.be.rejectedWith(/must be deregisterable/);
    });

    it("only darknode owner can deregister darknode", async () => {
        await dnr.deregister(ID("0"), { from: accounts[9] }).should.be.rejectedWith(/must be darknode owner/);
    });

    it("can get the owner of the Dark Node", async () => {
        (await dnr.getDarknodeOwner.call(ID("0"))).should.equal(accounts[0]);
    });

    it("can get the bond of the Dark Node", async () => {
        (await dnr.getDarknodeBond.call(ID("0"))).should.bignumber.equal(MINIMUM_BOND);
    });

    it("can get the Public Key of the Dark Node", async () => {
        (await dnr.getDarknodePublicKey.call(ID("0"))).should.equal(PUBK("0"));
    });

    it("can deregister dark nodes", async () => {
        await dnr.deregister(ID("0"), { from: accounts[0] });
        await dnr.deregister(ID("1"), { from: accounts[1] });
        await dnr.deregister(ID("4"), { from: accounts[4] });
        await dnr.deregister(ID("5"), { from: accounts[5] });
        await dnr.deregister(ID("8"), { from: accounts[8] });
        await dnr.deregister(ID("9"), { from: accounts[9] });
        await waitForEpoch(dnr);
        (await dnr.isDeregistered.call(ID("0"))).should.be.true;
        (await dnr.isDeregistered.call(ID("1"))).should.be.true;
        (await dnr.isDeregistered.call(ID("4"))).should.be.true;
        (await dnr.isDeregistered.call(ID("5"))).should.be.true;
        (await dnr.isDeregistered.call(ID("8"))).should.be.true;
        (await dnr.isDeregistered.call(ID("9"))).should.be.true;
    });

    it("can't deregister twice", async () => {
        await dnr.deregister(ID("0"), { from: accounts[0] }).should.be.rejectedWith(/must be deregisterable/);
    });

    it("can get the current epoch's registered dark nodes", async () => {
        const nodes = (await dnr.getDarknodes.call(NULL, 0)).filter((x) => x !== NULL);
        (nodes.length).should.equal(accounts.length - 6);
        nodes[0].should.equal(ID("2"));
        nodes[1].should.equal(ID("3"));
        nodes[2].should.equal(ID("6"));
        nodes[3].should.equal(ID("7"));
    });

    it("can get the previous epoch's registered dark nodes", async () => {
        let nodes = (await dnr.getPreviousDarknodes.call(NULL, 0)).filter((x) => x !== NULL);
        (nodes.length).should.equal(accounts.length);

        await waitForEpoch(dnr);

        nodes = (await dnr.getPreviousDarknodes.call(NULL, 0)).filter((x) => x !== NULL);
        (nodes.length).should.equal(accounts.length - 6);
    });

    it("can get the dark nodes in multiple calls", async () => {
        const nodes = [];

        let start = NULL;
        do {
            const newNodes = await dnr.getDarknodes.call(start, 2);
            start = newNodes[newNodes.length - 1];
            for (const node of newNodes) {
                if (node !== NULL && nodes.indexOf(node) === -1) {
                    nodes.push(node);
                }
            }
        } while (start !== NULL);

        (nodes.length).should.equal(accounts.length - 6);
        nodes[0].should.equal(ID("2"));
        nodes[1].should.equal(ID("3"));
        nodes[2].should.equal(ID("6"));
        nodes[3].should.equal(ID("7"));
    });

    it("can get the previous epoch's dark nodes in multiple calls", async () => {
        const nodes = [];

        let start = NULL;
        do {
            const newNodes = await dnr.getPreviousDarknodes.call(start, 2);
            start = newNodes[newNodes.length - 1];
            for (const node of newNodes) {
                if (node !== NULL && nodes.indexOf(node) === -1) {
                    nodes.push(node);
                }
            }
        } while (start !== NULL);

        (nodes.length).should.equal(accounts.length - 6);
        nodes[0].should.equal(ID("2"));
        nodes[1].should.equal(ID("3"));
        nodes[2].should.equal(ID("6"));
        nodes[3].should.equal(ID("7"));
    });

    it("should fail to refund before deregistering", async () => {
        await dnr.refund(ID("3"), { from: accounts[3] }).should.be.rejectedWith(/must be deregistered/);
    });

    it("can deregister and refund dark nodes", async () => {
        // Deregister
        await dnr.deregister(ID("2"), { from: accounts[2] });
        await dnr.deregister(ID("3"), { from: accounts[3] });
        await dnr.deregister(ID("6"), { from: accounts[6] });
        await dnr.deregister(ID("7"), { from: accounts[7] });

        (await dnr.isPendingDeregistration.call(ID("2"))).should.be.true;
        (await dnr.isPendingDeregistration.call(ID("3"))).should.be.true;
        (await dnr.isPendingDeregistration.call(ID("6"))).should.be.true;
        (await dnr.isPendingDeregistration.call(ID("7"))).should.be.true;

        // Call epoch
        await waitForEpoch(dnr);

        (await dnr.isRegisteredInPreviousEpoch.call(ID("2"))).should.be.true;
        (await dnr.isRegisteredInPreviousEpoch.call(ID("3"))).should.be.true;
        (await dnr.isRegisteredInPreviousEpoch.call(ID("6"))).should.be.true;
        (await dnr.isRegisteredInPreviousEpoch.call(ID("7"))).should.be.true;
        (await dnr.isDeregistered.call(ID("2"))).should.be.true;
        (await dnr.isDeregistered.call(ID("3"))).should.be.true;
        (await dnr.isDeregistered.call(ID("6"))).should.be.true;
        (await dnr.isDeregistered.call(ID("7"))).should.be.true;
        const previousDarknodesEpoch1 = (await dnr.getPreviousDarknodes.call(NULL, 0)).filter((x) => x !== NULL);
        await waitForEpoch(dnr);
        const previousDarknodesEpoch2 = (await dnr.getPreviousDarknodes.call(NULL, 0)).filter((x) => x !== NULL);
        (previousDarknodesEpoch1.length - previousDarknodesEpoch2.length).should.be.equal(4);
        (await dnr.isDeregistered.call(ID("2"))).should.be.true;
        (await dnr.isDeregistered.call(ID("3"))).should.be.true;
        (await dnr.isDeregistered.call(ID("6"))).should.be.true;
        (await dnr.isDeregistered.call(ID("7"))).should.be.true;

        // Refund
        await dnr.refund(ID("2"), { from: accounts[2] });
        await dnr.refund(ID("3"), { from: accounts[3] });
        await dnr.refund(ID("6"), { from: accounts[6] });
        await dnr.refund(ID("7"), { from: accounts[7] });

        (await dnr.isRefunded.call(ID("2"))).should.be.true;
        (await dnr.isRefunded.call(ID("3"))).should.be.true;
        (await dnr.isRefunded.call(ID("6"))).should.be.true;
        (await dnr.isRefunded.call(ID("7"))).should.be.true;
        (await ren.balanceOf.call(accounts[2])).should.bignumber.equal(MINIMUM_BOND);
        (await ren.balanceOf.call(accounts[3])).should.bignumber.equal(MINIMUM_BOND);
        (await ren.balanceOf.call(accounts[6])).should.bignumber.equal(MINIMUM_BOND);
        (await ren.balanceOf.call(accounts[7])).should.bignumber.equal(MINIMUM_BOND);
    });

    it("anyone can refund", async () => {
        const owner = accounts[2];
        const id = ID("2");
        const pubk = PUBK("2");

        // [SETUP] Register and then deregister nodes
        await ren.approve(dnr.address, MINIMUM_BOND, { from: owner });
        await dnr.register(id, pubk, { from: owner });
        await waitForEpoch(dnr);
        await dnr.deregister(id, { from: owner });
        (await dnr.isPendingDeregistration.call(id)).should.be.true;
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);

        // [ACTION] Refund
        await dnr.refund(id, { from: accounts[0] });

        // [CHECK] Refund was successful and bond was returned
        (await dnr.isRefunded.call(id)).should.be.true;
        (await ren.balanceOf.call(owner)).should.bignumber.equal(MINIMUM_BOND);
    });

    it("should fail to refund twice", async () => {
        await dnr.refund(ID("2")).should.be.rejectedWith(/must be deregistered for at least one epoch/);
    });

    it("should throw if refund fails", async () => {
        // [SETUP]
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[0] });
        await dnr.register(ID("2"), PUBK("2"));
        await waitForEpoch(dnr);
        await dnr.deregister(ID("2"));
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);

        // [CHECK] Refund fails if transfer fails
        await ren.pause();
        await dnr.refund(ID("2")).should.be.rejectedWith(/revert/); // paused contract
        await ren.unpause();

        // [RESET]
        await dnr.refund(ID("2"));
    });

    it("should not refund for an address which is never registered", async () => {
        await dnr.refund(ID("-1")).should.be.rejectedWith(/must be deregistered for at least one epoch/);
    });

    it("cannot update DarknodePayment to an invalid address", async () => {
        await dnr.updateDarknodePayment(NULL)
            .should.be.rejectedWith("invalid dnp address");
    });

    it("cannot slash with an invalid percent", async () => {
        // [ACTION] Update slasher address
        const newSlasher = accounts[0];
        await dnr.updateSlasher(newSlasher);
        await waitForEpoch(dnr);
        (await dnr.slasher.call()).should.equal(newSlasher);
        await dnr.slash(ID("2"), newSlasher, new BN(101)).should.eventually.be.rejectedWith(/invalid percent/);
        await dnr.slash(ID("2"), newSlasher, new BN(328293)).should.eventually.be.rejectedWith(/invalid percent/);
        await dnr.slash(ID("2"), newSlasher, new BN(923)).should.eventually.be.rejectedWith(/invalid percent/);
        await dnr.updateSlasher(slasher.address);
        await waitForEpoch(dnr);
        (await dnr.slasher.call()).should.equal(slasher.address);
    });

    it("can update slasher address", async () => {
        // [CHECK] This test assumes different previous and new slashers
        const previousSlasher = await dnr.slasher.call();
        const newSlasher = accounts[3];
        previousSlasher.should.not.equal(newSlasher);

        // [CHECK] The slasher can't be updated to 0x0
        await dnr.updateSlasher(NULL)
            .should.be.rejectedWith("invalid slasher address");

        // [ACTION] Update slasher address
        await dnr.updateSlasher(newSlasher);
        // [CHECK] Verify the address hasn't changed before an epoch
        (await dnr.slasher.call()).should.equal(previousSlasher);

        // [CHECK] Verify the new slasher address after an epoch
        await waitForEpoch(dnr);
        (await dnr.slasher.call()).should.equal(newSlasher);

        // [RESET] Reset the slasher address to the previous slasher address
        await dnr.updateSlasher(previousSlasher);
        await waitForEpoch(dnr);
        (await dnr.slasher.call()).should.equal(previousSlasher);
    });

    it("anyone except the slasher can not call slash", async () => {
        // [SETUP] Set slasher to accounts[3]
        const slasherOwner = accounts[0];
        const notSlasher = accounts[4];

        // [SETUP] Register darknodes 3, 4, 7 and 8
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[2] });
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[3] });
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[6] });
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[7] });
        await dnr.register(ID("2"), PUBK("2"), { from: accounts[2] });
        await dnr.register(ID("3"), PUBK("3"), { from: accounts[3] });
        await dnr.register(ID("6"), PUBK("6"), { from: accounts[6] });
        await dnr.register(ID("7"), PUBK("7"), { from: accounts[7] });
        await waitForEpoch(dnr);
        await dnr.deregister(ID("3"), { from: accounts[3] });
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);

        const slashPercent = 20;

        // [CHECK] Only the slasher can call `slash`
        await dnr.slash(ID("2"), ID("6"), slashPercent, { from: notSlasher })
            .should.be.rejectedWith(/must be slasher/);
        await dnr.slash(ID("2"), ID("6"), slashPercent, { from: slasherOwner })
            .should.be.rejectedWith(/must be slasher/);
        await slasher.slash(ID("2"), ID("6"), slashPercent, { from: notSlasher })
            .should.be.rejectedWith(/revert/);

        await slasher.slash(ID("2"), ID("6"), slashPercent, { from: slasherOwner });
        await slasher.slash(ID("3"), ID("6"), slashPercent, { from: slasherOwner });

        // // NOTE: The darknode doesn't prevent slashing a darknode twice
        await slasher.slash(ID("3"), ID("6"), slashPercent, { from: slasherOwner });
    });

    it("transfer ownership of the dark node store", async () => {
        // [ACTION] Initiate ownership transfer to wrong account
        await dnr.transferStoreOwnership(accounts[1]);

        // [ACTION] Can correct ownership transfer
        await dnr.transferStoreOwnership(accounts[0]);

        // [CHECK] Owner should still be the DNR
        (await dnrs.owner.call()).should.equal(dnr.address);

        // [ACTION] Claim ownership
        await dnrs.claimOwnership();

        // [CHECK] Owner should now be main account
        (await dnrs.owner.call()).should.equal(accounts[0]);

        // [RESET] Initiate ownership transfer back to DNR
        await dnrs.transferOwnership(dnr.address);

        // [CHECK] Owner should still be main account
        (await dnrs.owner.call()).should.equal(accounts[0]);

        // [RESET] Claim ownership
        await dnr.claimStoreOwnership();

        // [CHECK] Owner should now be the DNR
        (await dnrs.owner.call()).should.equal(dnr.address);
    });

    it("can't arbitrarily increase bond", async () => {
        // [SETUP] Transfer store to main account
        await dnr.transferStoreOwnership(accounts[0]);
        await dnrs.claimOwnership();

        const previousRenBalance = new BN(await ren.balanceOf.call(accounts[0]));

        // [ACTION] Decrease bond (used for bond slashing)
        const difference = new BN(1);
        const previousBond = new BN(await dnrs.darknodeBond.call(ID("7")));
        await dnrs.updateDarknodeBond(ID("7"), previousBond.sub(difference));

        // [CHECK] Decreasing bond transfers different to owner
        const afterRenBalance = new BN(await ren.balanceOf.call(accounts[0]));
        afterRenBalance.sub(previousRenBalance).should.be.bignumber.equal(difference);

        // [CHECK] Can't increase bond again
        await dnrs.updateDarknodeBond(ID("7"), previousBond)
            .should.be.rejectedWith(/bond not decreased/);

        // [RESET] Transfer store back to DNR
        await dnrs.transferOwnership(dnr.address);
        await dnr.claimStoreOwnership();
    });

    it("can't decrease bond without transferring REN", async () => {
        // [SETUP] Transfer store to main account
        await dnr.transferStoreOwnership(accounts[0]);
        await dnrs.claimOwnership();

        // [SETUP] Pause REN to make transfer fail
        await ren.pause();

        // [CHECK] Can't decrease bond if REN is paused
        await dnrs.updateDarknodeBond(ID("7"), new BN(0))
            .should.be.rejectedWith(/revert/);

        // [RESET] Unpause REN
        await ren.unpause();

        // [RESET] Transfer store back to DNR
        await dnrs.transferOwnership(dnr.address);
        await dnr.claimStoreOwnership();
    });

    describe("when darknode payment is not set", async () => {
        let newDNRstore: DarknodeRegistryStoreInstance;
        let newDNR: DarknodeRegistryInstance;

        before(async () => {
            // Deploy a new DNR and DNR store
            newDNRstore = await DarknodeRegistryStore.new("test", RenToken.address);
            newDNR = await DarknodeRegistry.new(
                "test",
                RenToken.address,
                newDNRstore.address,
                config.MINIMUM_BOND,
                config.MINIMUM_POD_SIZE,
                config.MINIMUM_EPOCH_INTERVAL_SECONDS,
            );
            // Initiate ownership transfer of DNR store
            await newDNRstore.transferOwnership(newDNR.address);
            // Claim ownership
            await newDNR.claimStoreOwnership();
        });

        it("can still call epoch", async () => {
            await waitForEpoch(newDNR);
            await waitForEpoch(newDNR);
        });

        it("cannot slash", async () => {
            (await newDNR.owner.call()).should.equal(accounts[0]);
            const newSlasher = accounts[0];
            await newDNR.updateSlasher(newSlasher);
            await waitForEpoch(newDNR);
            (await newDNR.slasher.call()).should.equal(newSlasher);

            // We should have enough balance to register a darknode
            if (new BN(await ren.balanceOf.call(accounts[8])).lt(MINIMUM_BOND)) {
                await ren.transfer(accounts[8], MINIMUM_BOND);
            }
            await ren.approve(newDNR.address, MINIMUM_BOND, { from: accounts[8] });
            await newDNR.register(ID("8"), PUBK("8"), { from: accounts[8] });
            await newDNR.slash(ID("8"), newSlasher, new BN(10))
                .should.eventually.be.rejectedWith(/invalid payment address/);
        });
    });

    // Takes 30 minutes - keep as it.skip when not running
    it.skip("[LONG] can register 6000 dark nodes", async () => {
        const MAX_DARKNODES = 6000;

        // Fund the darknode operator (6000 dark nodes cost a lot to operate!)
        for (let i = 1; i < accounts.length; i++) {
            const balance = await web3.eth.getBalance(accounts[i]);
            web3.eth.sendTransaction(
                { to: accounts[0], from: accounts[i], value: balance, gasPrice: 0 },
            );
        }

        await ren.approve(dnr.address, MINIMUM_BOND.mul(new BN(MAX_DARKNODES)));

        for (let i = 0; i < MAX_DARKNODES; i++) {
            process.stdout.write(`\rRegistering Darknode #${i}`);

            await dnr.register(ID(i), PUBK(i));
        }

        console.debug("");

        await waitForEpoch(dnr);

        let start = NULL;
        do {
            const nodes = await dnr.getDarknodes.call(start, 50);
            console.debug(nodes);
            start = nodes[nodes.length - 1];
        } while (start !== NULL);

        const numDarknodes = await dnr.numDarknodes.call();
        numDarknodes.should.bignumber.equal(MAX_DARKNODES);

        for (let i = 0; i < MAX_DARKNODES; i++) {
            process.stdout.write(`\rDeregistering Darknode #${i}`);
            await dnr.deregister(ID(i));
        }

        console.debug("");

        await waitForEpoch(dnr);
        await waitForEpoch(dnr);

        for (let i = 0; i < MAX_DARKNODES; i++) {
            process.stdout.write(`\rRefunding Darknode #${i}`);
            await dnr.refund(ID(i));
        }

        console.debug("");
    });

});
