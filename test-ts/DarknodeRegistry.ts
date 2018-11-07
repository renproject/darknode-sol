import BigNumber from "bignumber.js";

import {
    ID, MINIMUM_BOND, MINIMUM_EPOCH_INTERVAL, MINIMUM_POD_SIZE,
    NULL, PUBK, waitForEpoch,
} from "./helper/testUtils";

import { TestHelper } from "zos";

import * as deployRepublicProtocolContracts from "../migrations/deploy";

const fixWeb3 = require("../migrations/fixWeb3");
const defaultConfig = require("../migrations/config");

import { DarknodeRegistryContract } from "./bindings/darknode_registry";
import { RepublicTokenContract } from "./bindings/republic_token";

// Test that the epoch can only be called by the owner
contract("DarknodeRegistry (epoch testing)", (accounts: string[]) => {

    const proxyOwner = accounts[9];
    const contractOwner = accounts[8];

    let darknodeRegistry: DarknodeRegistryContract;

    before(async () => {
        fixWeb3(web3, artifacts);
        this.app = await TestHelper({ from: proxyOwner, gasPrice: 10000000000 });
        const config = { ...defaultConfig, CONTRACT_OWNER: contractOwner };
        ({ darknodeRegistry } = await deployRepublicProtocolContracts(artifacts, this.app, config));
    });

    it("first epoch can only be called by the owner", async () => {
        await darknodeRegistry.epoch({ from: accounts[1] }).should.be.rejectedWith(null, /not authorized/);
        await darknodeRegistry.epoch({ from: contractOwner })
            .should.not.be.rejected;
    });
});

contract("DarknodeRegistry", (accounts: string[]) => {

    const proxyOwner = accounts[9];
    const contractOwner = accounts[8];
    const notOwner = accounts[7];

    const ACCOUNT_LOOP_LIMIT = accounts.length - 1;

    let republicToken: RepublicTokenContract;
    let darknodeRegistry: DarknodeRegistryContract;

    before(async () => {
        fixWeb3(web3, artifacts);
        this.app = await TestHelper({ from: proxyOwner, gasPrice: 10000000000 });
        const config = { ...defaultConfig, CONTRACT_OWNER: contractOwner };
        ({ darknodeRegistry, republicToken } = await deployRepublicProtocolContracts(artifacts, this.app, config));

        for (let i = 0; i < ACCOUNT_LOOP_LIMIT; i++) {
            await republicToken.transfer(accounts[i], MINIMUM_BOND.toFixed(), { from: contractOwner });
        }

        await darknodeRegistry.epoch({ from: contractOwner });
    });

    it("should return empty list when no darknodes are registered", async () => {
        const nodes = (await darknodeRegistry.getPreviousDarknodes(NULL, 100)).filter((x) => x !== NULL);
        (nodes.length).should.equal(0);
    });

    it("can update minimum bond", async () => {
        await darknodeRegistry.updateMinimumBond(0x1, { from: contractOwner });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        (await darknodeRegistry.minimumBond()).should.bignumber.equal(1);
        await darknodeRegistry.updateMinimumBond(MINIMUM_BOND.toFixed(), { from: notOwner })
            .should.be.rejectedWith(null, /revert/); // not owner
        await darknodeRegistry.updateMinimumBond(MINIMUM_BOND.toFixed(), { from: contractOwner });
        (await darknodeRegistry.minimumBond()).should.bignumber.equal(1);
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        (await darknodeRegistry.minimumBond()).should.bignumber.equal(MINIMUM_BOND);
    });

    it("can update minimum pod size", async () => {
        await darknodeRegistry.updateMinimumPodSize(0x0, { from: contractOwner });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        (await darknodeRegistry.minimumPodSize()).should.bignumber.equal(0);
        await darknodeRegistry.updateMinimumPodSize(MINIMUM_POD_SIZE, { from: notOwner })
            .should.be.rejectedWith(null, /revert/); // not owner
        await darknodeRegistry.updateMinimumPodSize(MINIMUM_POD_SIZE, { from: contractOwner });
        (await darknodeRegistry.minimumPodSize()).should.bignumber.equal(0);
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        (await darknodeRegistry.minimumPodSize()).should.bignumber.equal(MINIMUM_POD_SIZE);
    });

    it("can update minimum epoch interval", async () => {
        await darknodeRegistry.updateMinimumEpochInterval(0x0, { from: contractOwner });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        (await darknodeRegistry.minimumEpochInterval()).should.bignumber.equal(0);
        await darknodeRegistry.updateMinimumEpochInterval(MINIMUM_EPOCH_INTERVAL, { from: notOwner })
            .should.be.rejectedWith(null, /revert/); // not owner
        await darknodeRegistry.updateMinimumEpochInterval(MINIMUM_EPOCH_INTERVAL, { from: contractOwner });
        (await darknodeRegistry.minimumEpochInterval()).should.bignumber.equal(0);
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        (await darknodeRegistry.minimumEpochInterval()).should.bignumber.equal(MINIMUM_EPOCH_INTERVAL);
    });

    it("can not register a Dark Node with a bond less than the minimum bond", async () => {
        const lowBond = MINIMUM_BOND.minus(1);
        await republicToken.approve(darknodeRegistry.address, lowBond.toFixed(), { from: accounts[0] });
        await darknodeRegistry.register(ID("A"), PUBK("A"), { from: accounts[0] })
            .should.be.rejectedWith(null, /revert/); // failed transfer
    });

    it("can not call epoch before the minimum time interval", async () => {
        await darknodeRegistry.epoch({ from: accounts[0] });
        // TODO: Why isn't reason returned?
        await darknodeRegistry.epoch({ from: accounts[0] }).should.be.rejectedWith(null, /revert/);
    });

    it("can register, deregister and refund Darknodes", async () => {
        // [ACTION] Register
        for (let i = 0; i < ACCOUNT_LOOP_LIMIT - 1; i++) {
            await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: accounts[i] });
            await darknodeRegistry.register(ID(i), PUBK(i), { from: accounts[i] });
        }

        // Wait for epoch
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        // [ACTION] Deregister
        for (let i = 0; i < ACCOUNT_LOOP_LIMIT - 1; i++) {
            await darknodeRegistry.deregister(ID(i), { from: accounts[i] });
        }

        // Wait for two epochs
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        // [ACTION] Refund
        for (let i = 0; i < ACCOUNT_LOOP_LIMIT - 1; i++) {
            await darknodeRegistry.refund(ID(i), { from: accounts[i] });
        }
    });

    it("can check darknode statuses", async () => {
        // WARNING: A lot of code a head

        const owner = accounts[2];
        const id = ID("0");
        const pubk = PUBK("0");

        // [SETUP] Wait for epoch to reset `isRegisteredInPreviousEpoch`
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        // [CHECK]
        (await darknodeRegistry.isRefunded(id))
            .should.be.true;
        (await darknodeRegistry.isPendingRegistration(id)).should.be.false;
        (await darknodeRegistry.isRegistered(id)).should.be.false;
        (await darknodeRegistry.isDeregisterable(id)).should.be.false;
        (await darknodeRegistry.isPendingDeregistration(id)).should.be.false;
        (await darknodeRegistry.isDeregistered(id)).should.be.false;
        (await darknodeRegistry.isRefundable(id)).should.be.false;
        (await darknodeRegistry.isRegisteredInPreviousEpoch(id)).should.be.false;

        // [ACTION] Register
        await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: owner });
        await darknodeRegistry.register(id, pubk, { from: owner });

        // [CHECK]
        (await darknodeRegistry.isRefunded(id)).should.be.false;
        (await darknodeRegistry.isPendingRegistration(id))
            .should.be.true;
        (await darknodeRegistry.isRegistered(id)).should.be.false;
        (await darknodeRegistry.isDeregisterable(id)).should.be.false;
        (await darknodeRegistry.isPendingDeregistration(id)).should.be.false;
        (await darknodeRegistry.isDeregistered(id)).should.be.false;
        (await darknodeRegistry.isRefundable(id)).should.be.false;
        (await darknodeRegistry.isRegisteredInPreviousEpoch(id)).should.be.false;

        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        // [CHECK]
        (await darknodeRegistry.isRefunded(id)).should.be.false;
        (await darknodeRegistry.isPendingRegistration(id)).should.be.false;
        (await darknodeRegistry.isRegistered(id))
            .should.be.true;
        (await darknodeRegistry.isDeregisterable(id))
            .should.be.true;
        (await darknodeRegistry.isPendingDeregistration(id)).should.be.false;
        (await darknodeRegistry.isDeregistered(id)).should.be.false;
        (await darknodeRegistry.isRefundable(id)).should.be.false;
        (await darknodeRegistry.isRegisteredInPreviousEpoch(id)).should.be.false;

        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        // [CHECK]
        (await darknodeRegistry.isRefunded(id)).should.be.false;
        (await darknodeRegistry.isPendingRegistration(id)).should.be.false;
        (await darknodeRegistry.isRegistered(id))
            .should.be.true;
        (await darknodeRegistry.isDeregisterable(id))
            .should.be.true;
        (await darknodeRegistry.isPendingDeregistration(id)).should.be.false;
        (await darknodeRegistry.isDeregistered(id)).should.be.false;
        (await darknodeRegistry.isRefundable(id)).should.be.false;
        (await darknodeRegistry.isRegisteredInPreviousEpoch(id))
            .should.be.true;

        // [ACTION] Deregister
        await darknodeRegistry.deregister(id, { from: owner });

        // [CHECK]
        (await darknodeRegistry.isRefunded(id)).should.be.false;
        (await darknodeRegistry.isPendingRegistration(id)).should.be.false;
        (await darknodeRegistry.isRegistered(id))
            .should.be.true;
        (await darknodeRegistry.isDeregisterable(id)).should.be.false;
        (await darknodeRegistry.isPendingDeregistration(id))
            .should.be.true;
        (await darknodeRegistry.isDeregistered(id)).should.be.false;
        (await darknodeRegistry.isRefundable(id)).should.be.false;
        (await darknodeRegistry.isRegisteredInPreviousEpoch(id))
            .should.be.true;

        // [ACTION] Wait for epoch
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        (await darknodeRegistry.isRefunded(id)).should.be.false;
        (await darknodeRegistry.isPendingRegistration(id)).should.be.false;
        (await darknodeRegistry.isRegistered(id)).should.be.false;
        (await darknodeRegistry.isDeregisterable(id)).should.be.false;
        (await darknodeRegistry.isPendingDeregistration(id)).should.be.false;
        (await darknodeRegistry.isDeregistered(id))
            .should.be.true;
        (await darknodeRegistry.isRefundable(id)).should.be.false;
        (await darknodeRegistry.isRegisteredInPreviousEpoch(id))
            .should.be.true;

        // [ACTION] Wait for epoch
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        (await darknodeRegistry.isRefunded(id)).should.be.false;
        (await darknodeRegistry.isPendingRegistration(id)).should.be.false;
        (await darknodeRegistry.isRegistered(id)).should.be.false;
        (await darknodeRegistry.isDeregisterable(id)).should.be.false;
        (await darknodeRegistry.isPendingDeregistration(id)).should.be.false;
        (await darknodeRegistry.isDeregistered(id))
            .should.be.true;
        (await darknodeRegistry.isRefundable(id))
            .should.be.true;
        (await darknodeRegistry.isRegisteredInPreviousEpoch(id)).should.be.false;

        // [ACTION] Refund
        await darknodeRegistry.refund(id, { from: accounts[0] });

        (await darknodeRegistry.isRefunded(id))
            .should.be.true;
        (await darknodeRegistry.isPendingRegistration(id)).should.be.false;
        (await darknodeRegistry.isRegistered(id)).should.be.false;
        (await darknodeRegistry.isDeregisterable(id)).should.be.false;
        (await darknodeRegistry.isPendingDeregistration(id)).should.be.false;
        (await darknodeRegistry.isDeregistered(id)).should.be.false;
        (await darknodeRegistry.isRefundable(id)).should.be.false;
        (await darknodeRegistry.isRegisteredInPreviousEpoch(id)).should.be.false;
    });

    it("bond is exactly the minimum bond", async () => {
        const owner = accounts[2];
        const id = ID("0");
        const pubk = PUBK("0");

        const renBalanceBefore = new BigNumber((await republicToken.balanceOf(owner)));

        // Approve more than minimum bond
        await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.times(2).toFixed(), { from: owner });

        // Register
        await darknodeRegistry.register(id, pubk, { from: owner });

        // Only minimum bond should have been transferred
        (await republicToken.balanceOf(owner)).should.bignumber.equal(renBalanceBefore.minus(MINIMUM_BOND));

        // [RESET]
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        await darknodeRegistry.deregister(id, { from: owner });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        await darknodeRegistry.refund(id, { from: owner });
    });

    it("[SETUP] Register darknodes for next tests", async () => {
        for (let i = 0; i < ACCOUNT_LOOP_LIMIT; i++) {
            await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: accounts[i] });
            await darknodeRegistry.register(ID(i), PUBK(i), { from: accounts[i] });
        }
        await darknodeRegistry.epoch({ from: accounts[0] });
    });

    it("can not register a node twice", async () => {
        await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: accounts[0] });
        await darknodeRegistry.register(ID("0"), PUBK("0"), { from: accounts[0] })
            .should.be.rejectedWith(null, /must be refunded or never registered/);
    });

    it("can not deregister a node which is not registered", async () => {
        await darknodeRegistry.deregister(ID("-1"), { from: accounts[0] })
            .should.be.rejectedWith(null, /must be deregisterable/);
    });

    it("only darknode owner can deregister darknode", async () => {
        await darknodeRegistry.deregister(ID("0"), { from: accounts[1] })
            .should.be.rejectedWith(null, /must be darknode owner/);
    });

    it("can get the owner of the Dark Node", async () => {
        (await darknodeRegistry.getDarknodeOwner(ID("0"))).should.address.equal(accounts[0]);
    });

    it("can get the bond of the Dark Node", async () => {
        (await darknodeRegistry.getDarknodeBond(ID("0"))).should.bignumber.equal(MINIMUM_BOND);
    });

    it("can get the Public Key of the Dark Node", async () => {
        (await darknodeRegistry.getDarknodePublicKey(ID("0"))).should.equal(PUBK("0"));
    });

    it("can deregister dark nodes", async () => {
        await darknodeRegistry.deregister(ID("0"), { from: accounts[0] });
        await darknodeRegistry.deregister(ID("1"), { from: accounts[1] });
        await darknodeRegistry.deregister(ID("4"), { from: accounts[4] });
        await darknodeRegistry.deregister(ID("5"), { from: accounts[5] });
        await darknodeRegistry.deregister(ID("8"), { from: accounts[8] });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        (await darknodeRegistry.isDeregistered(ID("0"))).should.be.true;
        (await darknodeRegistry.isDeregistered(ID("1"))).should.be.true;
        (await darknodeRegistry.isDeregistered(ID("4"))).should.be.true;
        (await darknodeRegistry.isDeregistered(ID("5"))).should.be.true;
        (await darknodeRegistry.isDeregistered(ID("8"))).should.be.true;
    });

    it("can't deregister twice", async () => {
        await darknodeRegistry.deregister(ID("0"), { from: accounts[0] })
            .should.be.rejectedWith(null, /must be deregisterable/);
    });

    it("can get the current epoch's registered dark nodes", async () => {
        const nodes = (await darknodeRegistry.getDarknodes(NULL, 0)).filter((x) => x !== NULL);
        (nodes.length).should.equal(ACCOUNT_LOOP_LIMIT - 5);
        nodes[0].should.address.equal(ID("2"));
        nodes[1].should.address.equal(ID("3"));
        nodes[2].should.address.equal(ID("6"));
        nodes[3].should.address.equal(ID("7"));
    });

    it("can get the previous epoch's registered dark nodes", async () => {
        let nodes = (await darknodeRegistry.getPreviousDarknodes(NULL, 0)).filter((x) => x !== NULL);
        (nodes.length).should.equal(ACCOUNT_LOOP_LIMIT);

        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        nodes = (await darknodeRegistry.getPreviousDarknodes(NULL, 0)).filter((x) => x !== NULL);
        (nodes.length).should.equal(ACCOUNT_LOOP_LIMIT - 5);
    });

    it("can get the dark nodes in multiple calls", async () => {
        const nodes = [];

        let start = NULL;
        do {
            const newNodes = await darknodeRegistry.getDarknodes(start, 2);
            start = newNodes[newNodes.length - 1];
            for (const node of newNodes) {
                if (node !== NULL && nodes.indexOf(node) === -1) {
                    nodes.push(node);
                }
            }
        } while (start !== NULL);

        (nodes.length).should.equal(ACCOUNT_LOOP_LIMIT - 5);
        nodes[0].should.address.equal(ID("2"));
        nodes[1].should.address.equal(ID("3"));
        nodes[2].should.address.equal(ID("6"));
        nodes[3].should.address.equal(ID("7"));
    });

    it("can get the previous epoch's dark nodes in multiple calls", async () => {
        const nodes = [];

        let start = NULL;
        do {
            const newNodes = await darknodeRegistry.getPreviousDarknodes(start, 2);
            start = newNodes[newNodes.length - 1];
            for (const node of newNodes) {
                if (node !== NULL && nodes.indexOf(node) === -1) {
                    nodes.push(node);
                }
            }
        } while (start !== NULL);

        (nodes.length).should.equal(ACCOUNT_LOOP_LIMIT - 5);
        nodes[0].should.address.equal(ID("2"));
        nodes[1].should.address.equal(ID("3"));
        nodes[2].should.address.equal(ID("6"));
        nodes[3].should.address.equal(ID("7"));
    });

    it("should fail to refund before deregistering", async () => {
        await darknodeRegistry.refund(ID("3"), { from: accounts[3] })
            .should.be.rejectedWith(null, /must be deregistered/);
    });

    it("can deregister and refund dark nodes", async () => {
        // Deregister
        await darknodeRegistry.deregister(ID("2"), { from: accounts[2] });
        await darknodeRegistry.deregister(ID("3"), { from: accounts[3] });
        await darknodeRegistry.deregister(ID("6"), { from: accounts[6] });
        await darknodeRegistry.deregister(ID("7"), { from: accounts[7] });

        (await darknodeRegistry.isPendingDeregistration(ID("2"))).should.be.true;
        (await darknodeRegistry.isPendingDeregistration(ID("3"))).should.be.true;
        (await darknodeRegistry.isPendingDeregistration(ID("6"))).should.be.true;
        (await darknodeRegistry.isPendingDeregistration(ID("7"))).should.be.true;

        // Call epoch
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        (await darknodeRegistry.isRegisteredInPreviousEpoch(ID("2"))).should.be.true;
        (await darknodeRegistry.isRegisteredInPreviousEpoch(ID("3"))).should.be.true;
        (await darknodeRegistry.isRegisteredInPreviousEpoch(ID("6"))).should.be.true;
        (await darknodeRegistry.isRegisteredInPreviousEpoch(ID("7"))).should.be.true;
        (await darknodeRegistry.isDeregistered(ID("2"))).should.be.true;
        (await darknodeRegistry.isDeregistered(ID("3"))).should.be.true;
        (await darknodeRegistry.isDeregistered(ID("6"))).should.be.true;
        (await darknodeRegistry.isDeregistered(ID("7"))).should.be.true;
        const previousDarknodesEpoch1 = (await darknodeRegistry.getPreviousDarknodes(NULL, 0))
            .filter((x) => x !== NULL);
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        const previousDarknodesEpoch2 = (await darknodeRegistry.getPreviousDarknodes(NULL, 0))
            .filter((x) => x !== NULL);
        (previousDarknodesEpoch1.length - previousDarknodesEpoch2.length).should.be.equal(4);
        (await darknodeRegistry.isDeregistered(ID("2"))).should.be.true;
        (await darknodeRegistry.isDeregistered(ID("3"))).should.be.true;
        (await darknodeRegistry.isDeregistered(ID("6"))).should.be.true;
        (await darknodeRegistry.isDeregistered(ID("7"))).should.be.true;

        // Refund
        await darknodeRegistry.refund(ID("2"), { from: accounts[2] });
        await darknodeRegistry.refund(ID("3"), { from: accounts[3] });
        await darknodeRegistry.refund(ID("6"), { from: accounts[6] });
        await darknodeRegistry.refund(ID("7"), { from: accounts[7] });

        (await darknodeRegistry.isRefunded(ID("2"))).should.be.true;
        (await darknodeRegistry.isRefunded(ID("3"))).should.be.true;
        (await darknodeRegistry.isRefunded(ID("6"))).should.be.true;
        (await darknodeRegistry.isRefunded(ID("7"))).should.be.true;
        (await republicToken.balanceOf(accounts[2])).should.bignumber.equal(MINIMUM_BOND);
        (await republicToken.balanceOf(accounts[3])).should.bignumber.equal(MINIMUM_BOND);
        (await republicToken.balanceOf(accounts[6])).should.bignumber.equal(MINIMUM_BOND);
        (await republicToken.balanceOf(accounts[7])).should.bignumber.equal(MINIMUM_BOND);
    });

    it("anyone can refund", async () => {
        const owner = accounts[2];
        const id = ID("2");
        const pubk = PUBK("2");

        // [SETUP] Register and then deregister nodes
        await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: owner });
        await darknodeRegistry.register(id, pubk, { from: owner });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        await darknodeRegistry.deregister(id, { from: owner });
        (await darknodeRegistry.isPendingDeregistration(id)).should.be.true;
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        // [ACTION] Refund
        await darknodeRegistry.refund(id, { from: accounts[0] });

        // [CHECK] Refund was successful and bond was returned
        (await darknodeRegistry.isRefunded(id)).should.be.true;
        (await republicToken.balanceOf(owner)).should.bignumber.equal(MINIMUM_BOND);
    });

    it("should fail to refund twice", async () => {
        await darknodeRegistry.refund(ID("2"), { from: accounts[0] })
            .should.be.rejectedWith(null, /must be deregistered for at least one epoch/);
    });

    it("should throw if refund fails", async () => {
        // [SETUP]
        await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: accounts[2] });
        await darknodeRegistry.register(ID("2"), PUBK("2"), { from: accounts[2] });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        await darknodeRegistry.deregister(ID("2"), { from: accounts[2] });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        // [CHECK] Refund fails if transfer fails
        await republicToken.pause({ from: contractOwner });
        await darknodeRegistry.refund(ID("2"), { from: accounts[2] })
            .should.be.rejectedWith(null, /revert/); // paused contract
        await republicToken.unpause({ from: contractOwner });

        // [RESET]
        await darknodeRegistry.refund(ID("2"), { from: accounts[2] });
    });

    it("should not refund for an address which is never registered", async () => {
        await darknodeRegistry.refund(ID("-1"), { from: accounts[0] })
            .should.be.rejectedWith(null, /must be deregistered for at least one epoch/);
    });

    it("can update slasher address", async () => {
        // [CHECK] This test assumes different previous and new slashers
        const previousSlasher = await darknodeRegistry.slasher();
        const newSlasher = accounts[3];
        previousSlasher.should.not.equal(newSlasher);

        // [CHECK] The slasher can't be updated to 0x0
        await darknodeRegistry.updateSlasher(NULL, { from: contractOwner })
            .should.be.rejectedWith(null, "invalid slasher address");

        // [ACTION] Update slasher address
        await darknodeRegistry.updateSlasher(newSlasher, { from: contractOwner });
        // [CHECK] Verify the address hasn't changed before an epoch
        (await darknodeRegistry.slasher()).should.address.equal(previousSlasher);

        // [CHECK] Verify the new slasher address after an epoch
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        (await darknodeRegistry.slasher()).should.address.equal(newSlasher);

        // [RESET] Reset the slasher address to the previous slasher address
        await darknodeRegistry.updateSlasher(previousSlasher, { from: contractOwner });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        (await darknodeRegistry.slasher()).should.address.equal(previousSlasher);
    });

    it("anyone except the slasher can not call slash", async () => {
        // [SETUP] Set slasher to accounts[3]
        const previousSlasher = await darknodeRegistry.slasher();
        const slasher = accounts[3];
        const notSlasher = accounts[4];
        await darknodeRegistry.updateSlasher(slasher, { from: contractOwner });

        // [SETUP] Register darknodes 3, 4, 7 and 8
        await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: accounts[2] });
        await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: accounts[3] });
        await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: accounts[6] });
        await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: accounts[7] });
        await darknodeRegistry.register(ID("2"), PUBK("2"), { from: accounts[2] });
        await darknodeRegistry.register(ID("3"), PUBK("3"), { from: accounts[3] });
        await darknodeRegistry.register(ID("6"), PUBK("6"), { from: accounts[6] });
        await darknodeRegistry.register(ID("7"), PUBK("7"), { from: accounts[7] });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        await darknodeRegistry.deregister(ID("3"), { from: accounts[3] });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        // [CHECK] Only the slasher can call `slash`
        await darknodeRegistry.slash(ID("2"), ID("6"), ID("7"), { from: notSlasher })
            .should.be.rejectedWith(null, /must be slasher/);
        await darknodeRegistry.slash(ID("2"), ID("6"), ID("7"), { from: slasher });
        await darknodeRegistry.slash(ID("3"), ID("6"), ID("7"), { from: slasher });

        // [RESET] Reset slasher to the slasher contract
        await darknodeRegistry.updateSlasher(previousSlasher, { from: contractOwner });
    });

    // it("transfer ownership of the dark node store", async () => {
    //     // [ACTION] Initiate ownership transfer to wrong account
    //     await darknodeRegistry.transferStoreOwnership(accounts[1]);

    //     // [ACTION] Can correct ownership transfer
    //     await darknodeRegistry.transferStoreOwnership(accounts[0]);

    //     // [CHECK] Owner should still be the DNR
    //     (await dnrs.owner()).should.equal(darknodeRegistry.address);

    //     // [ACTION] Claim ownership
    //     await dnrs.claimOwnership();

    //     // [CHECK] Owner should now be main account
    //     (await dnrs.owner()).should.equal(accounts[0]);

    //     // [RESET] Initiate ownership transfer back to DNR
    //     await dnrs.transferOwnership(darknodeRegistry.address);

    //     // [CHECK] Owner should still be main account
    //     (await dnrs.owner()).should.equal(accounts[0]);

    //     // [RESET] Claim ownership
    //     await darknodeRegistry.claimStoreOwnership();

    //     // [CHECK] Owner should now be the DNR
    //     (await dnrs.owner()).should.equal(darknodeRegistry.address);
    // });

    // it("can't arbitrarily increase bond", async () => {
    //     // [SETUP] Transfer store to main account
    //     await darknodeRegistry.transferStoreOwnership(accounts[0]);
    //     await dnrs.claimOwnership();

    //     const previousRenBalance = new BigNumber((await republicToken.balanceOf(accounts[0])));

    //     // [ACTION] Decrease bond (used for bond slashing)
    //     const difference = new BigNumber(1);
    //     const previousBond = new BigNumber((await dnrs.darknodeBond(ID("7"))));
    //     await dnrs.updateDarknodeBond(ID("7"), previousBond.minus(difference).toFixed());

    //     // [CHECK] Decreasing bond transfers different to owner
    //     const afterRenBalance = new BigNumber((await republicToken.balanceOf(accounts[0])));
    //     afterRenBalance.minus(previousRenBalance).should.be.bignumber.equal(difference);

    //     // [CHECK] Can't increase bond again
    //     await dnrs.updateDarknodeBond(ID("7"), previousBond.toFixed())
    //         .should.be.rejectedWith(null, /bond not decreased/);

    //     // [RESET] Transfer store back to DNR
    //     await dnrs.transferOwnership(darknodeRegistry.address);
    //     await darknodeRegistry.claimStoreOwnership();
    // });

    // it("can't decrease bond without transferring REN", async () => {
    //     // [SETUP] Transfer store to main account
    //     await darknodeRegistry.transferStoreOwnership(accounts[0]);
    //     await dnrs.claimOwnership();

    //     // [SETUP] Pause REN to make transfer fail
    //     await republicToken.pause();

    //     // [CHECK] Can't decrease bond if REN is paused
    //     await dnrs.updateDarknodeBond(ID("7"), "0")
    //         .should.be.rejectedWith(null, /revert/);

    //     // [RESET] Unpause REN
    //     await republicToken.unpause();

    //     // [RESET] Transfer store back to DNR
    //     await dnrs.transferOwnership(darknodeRegistry.address);
    //     await darknodeRegistry.claimStoreOwnership();
    // });

    // Takes 30 minutes - keep as it.skip when not running
    it.skip("[LONG] can register 6000 dark nodes", async () => {
        const MAX_DARKNODES = 6000;

        // Fund the darknode operator (6000 dark nodes cost a lot to operate!)
        for (let i = 0; i < ACCOUNT_LOOP_LIMIT; i++) {
            const balance = await web3.eth.getBalance(accounts[i]);
            web3.eth.sendTransaction(
                { to: accounts[0], from: accounts[i], value: balance, gasPrice: 0 },
            );
        }

        await republicToken.approve(
            darknodeRegistry.address,
            MINIMUM_BOND.times(new BigNumber(MAX_DARKNODES)).toFixed(),
            { from: accounts[0] },
        );

        for (let i = 0; i < MAX_DARKNODES; i++) {
            process.stdout.write(`\rRegistering Darknode #${i}`);

            await darknodeRegistry.register(ID(i), PUBK(i), { from: accounts[0] });
        }

        console.log("");

        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        let start = NULL;
        do {
            const nodes = await darknodeRegistry.getDarknodes(start, 50);
            console.log(nodes);
            start = nodes[nodes.length - 1];
        } while (start !== NULL);

        const numDarknodes = await darknodeRegistry.numDarknodes();
        numDarknodes.should.bignumber.equal(MAX_DARKNODES);

        for (let i = 0; i < MAX_DARKNODES; i++) {
            process.stdout.write(`\rDeregistering Darknode #${i}`);
            await darknodeRegistry.deregister(ID(i), { from: accounts[0] });
        }

        console.log("");

        await waitForEpoch(darknodeRegistry, { from: accounts[0] });
        await waitForEpoch(darknodeRegistry, { from: accounts[0] });

        for (let i = 0; i < MAX_DARKNODES; i++) {
            process.stdout.write(`\rRefunding Darknode #${i}`);
            await darknodeRegistry.refund(ID(i), { from: accounts[0] });
        }

        console.log("");
    });

});
