import { BN } from "bn.js";

import {
    ID, MINIMUM_BOND, MINIMUM_EPOCH_INTERVAL, MINIMUM_POD_SIZE,
    NULL, PUBK, waitForEpoch,
} from "./helper/testUtils";

import { DarknodeRegistryArtifact, DarknodeRegistryContract } from "./bindings/darknode_registry";
import { DarknodeRegistryStoreArtifact, DarknodeRegistryStoreContract } from "./bindings/darknode_registry_store";
import { RepublicTokenArtifact, RepublicTokenContract } from "./bindings/republic_token";

const RepublicToken = artifacts.require("RepublicToken") as RepublicTokenArtifact;
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore") as DarknodeRegistryStoreArtifact;
const DarknodeRegistry = artifacts.require("DarknodeRegistry") as DarknodeRegistryArtifact;

contract("DarknodeRegistry", (accounts: string[]) => {

    let ren: RepublicTokenContract;
    let dnrs: DarknodeRegistryStoreContract;
    let dnr: DarknodeRegistryContract;

    before(async () => {
        ren = await RepublicToken.deployed();
        dnrs = await DarknodeRegistryStore.deployed();
        dnr = await DarknodeRegistry.deployed();

        for (let i = 1; i < accounts.length; i++) {
            await ren.transfer(accounts[i], MINIMUM_BOND);
        }
    });

    it("first epoch can only be called by the owner", async () => {
        await dnr.epoch({ from: accounts[1] }).should.be.rejectedWith(null, /not authorized/);
    });

    it("should return empty list when no darknodes are registered", async () => {
        const nodes = (await dnr.getPreviousDarknodes(NULL, 100)).filter((x) => x !== NULL);
        (nodes.length).should.equal(0);
    });

    it("can update minimum bond", async () => {
        await dnr.updateMinimumBond(0x1);
        await waitForEpoch(dnr);
        (await dnr.minimumBond()).should.bignumber.equal(1);
        await dnr.updateMinimumBond(MINIMUM_BOND, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // not owner
        await dnr.updateMinimumBond(MINIMUM_BOND);
        (await dnr.minimumBond()).should.bignumber.equal(1);
        await waitForEpoch(dnr);
        (await dnr.minimumBond()).should.bignumber.equal(MINIMUM_BOND);
    });

    it("can update minimum pod size", async () => {
        await dnr.updateMinimumPodSize(0x0);
        await waitForEpoch(dnr);
        (await dnr.minimumPodSize()).should.bignumber.equal(0);
        await dnr.updateMinimumPodSize(MINIMUM_POD_SIZE, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // not owner
        await dnr.updateMinimumPodSize(MINIMUM_POD_SIZE);
        (await dnr.minimumPodSize()).should.bignumber.equal(0);
        await waitForEpoch(dnr);
        (await dnr.minimumPodSize()).should.bignumber.equal(MINIMUM_POD_SIZE);
    });

    it("can update minimum epoch interval", async () => {
        await dnr.updateMinimumEpochInterval(0x0);
        await waitForEpoch(dnr);
        (await dnr.minimumEpochInterval()).should.bignumber.equal(0);
        await dnr.updateMinimumEpochInterval(MINIMUM_EPOCH_INTERVAL, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // not owner
        await dnr.updateMinimumEpochInterval(MINIMUM_EPOCH_INTERVAL);
        (await dnr.minimumEpochInterval()).should.bignumber.equal(0);
        await waitForEpoch(dnr);
        (await dnr.minimumEpochInterval()).should.bignumber.equal(MINIMUM_EPOCH_INTERVAL);
    });

    it("can not register a Dark Node with a bond less than the minimum bond", async () => {
        const lowBond = MINIMUM_BOND.sub(new BN(1));
        await ren.approve(dnr.address, lowBond, { from: accounts[0] });
        await dnr.register(ID("A"), PUBK("A"), lowBond).should.be.rejectedWith(null, /insufficient bond/);
        await dnr.register(ID("A"), PUBK("A"), MINIMUM_BOND).should.be.rejectedWith(null, /revert/); // failed transfer
    });

    it("can not call epoch before the minimum time interval", async () => {
        await dnr.epoch();
        // TODO: Why isn't reason returned?
        await dnr.epoch().should.be.rejectedWith(null, /revert/);
    });

    it("can register multiple Dark Nodes and check registration", async () => {
        for (let i = 0; i < accounts.length; i++) {
            await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[i] });
            await dnr.register(ID(`${i + 1}`), PUBK(`${i + 1}`), MINIMUM_BOND, { from: accounts[i] });
        }
        for (let i = 0; i < accounts.length; i++) {
            (await dnr.isPendingRegistration(ID(`${i + 1}`))).should.be.true;
        }

        await waitForEpoch(dnr);
        for (let i = 0; i < accounts.length; i++) {
            (await dnr.isRegistered(ID(`${i + 1}`))).should.be.true;
        }
    });

    it("can not register a node twice", async () => {
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[0] });
        await dnr.register(ID("1"), PUBK("1"), MINIMUM_BOND)
            .should.be.rejectedWith(null, /must be refunded or never registered/);
    });

    it("can not deregister a node which is not registered", async () => {
        await dnr.deregister(ID("-1")).should.be.rejectedWith(null, /must be deregisterable/);
    });

    it("only darknode owner can deregister darknode", async () => {
        await dnr.deregister(ID("1"), { from: accounts[9] }).should.be.rejectedWith(null, /must be darknode owner/);
    });

    it("can get the owner of the Dark Node", async () => {
        (await dnr.getDarknodeOwner(ID("1"))).should.equal(accounts[0]);
    });

    it("can get the bond of the Dark Node", async () => {
        (await dnr.getDarknodeBond(ID("1"))).should.bignumber.equal(MINIMUM_BOND);
    });

    it("can get the Public Key of the Dark Node", async () => {
        (await dnr.getDarknodePublicKey(ID("1"))).should.equal(PUBK("1"));
    });

    it("can deregister dark nodes", async () => {
        await dnr.deregister(ID("1"), { from: accounts[0] });
        await dnr.deregister(ID("2"), { from: accounts[1] });
        await dnr.deregister(ID("5"), { from: accounts[4] });
        await dnr.deregister(ID("6"), { from: accounts[5] });
        await dnr.deregister(ID("9"), { from: accounts[8] });
        await dnr.deregister(ID("10"), { from: accounts[9] });
        await waitForEpoch(dnr);
        (await dnr.isDeregistered(ID("1"))).should.be.true;
        (await dnr.isDeregistered(ID("2"))).should.be.true;
        (await dnr.isDeregistered(ID("5"))).should.be.true;
        (await dnr.isDeregistered(ID("6"))).should.be.true;
        (await dnr.isDeregistered(ID("9"))).should.be.true;
        (await dnr.isDeregistered(ID("10"))).should.be.true;
    });

    it("can't deregister twice", async () => {
        await dnr.deregister(ID("1"), { from: accounts[0] }).should.be.rejectedWith(null, /must be deregisterable/);
    });

    it("can get the current epoch's registered dark nodes", async () => {
        const nodes = (await dnr.getDarknodes(NULL, 0)).filter((x) => x !== NULL);
        (nodes.length).should.equal(accounts.length - 6);
        nodes[0].should.equal(ID("3"));
        nodes[1].should.equal(ID("4"));
        nodes[2].should.equal(ID("7"));
        nodes[3].should.equal(ID("8"));
    });

    it("can get the previous epoch's registered dark nodes", async () => {
        let nodes = (await dnr.getPreviousDarknodes(NULL, 0)).filter((x) => x !== NULL);
        (nodes.length).should.equal(accounts.length);

        await waitForEpoch(dnr);

        nodes = (await dnr.getPreviousDarknodes(NULL, 0)).filter((x) => x !== NULL);
        (nodes.length).should.equal(accounts.length - 6);
    });

    it("can get the dark nodes in multiple calls", async () => {
        const nodes = [];

        let start = NULL;
        do {
            const newNodes = await dnr.getDarknodes(start, 2);
            start = newNodes[newNodes.length - 1];
            for (const node of newNodes) {
                if (node !== NULL && nodes.indexOf(node) === -1) {
                    nodes.push(node);
                }
            }
        } while (start !== NULL);

        (nodes.length).should.equal(accounts.length - 6);
        nodes[0].should.equal(ID("3"));
        nodes[1].should.equal(ID("4"));
        nodes[2].should.equal(ID("7"));
        nodes[3].should.equal(ID("8"));
    });

    it("can get the previous epoch's dark nodes in multiple calls", async () => {
        const nodes = [];

        let start = NULL;
        do {
            const newNodes = await dnr.getPreviousDarknodes(start, 2);
            start = newNodes[newNodes.length - 1];
            for (const node of newNodes) {
                if (node !== NULL && nodes.indexOf(node) === -1) {
                    nodes.push(node);
                }
            }
        } while (start !== NULL);

        (nodes.length).should.equal(accounts.length - 6);
        nodes[0].should.equal(ID("3"));
        nodes[1].should.equal(ID("4"));
        nodes[2].should.equal(ID("7"));
        nodes[3].should.equal(ID("8"));
    });

    it("should fail to refund before deregistering", async () => {
        await dnr.refund(ID("4"), { from: accounts[3] }).should.be.rejectedWith(null, /must be deregistered/);
    });

    it("can deregister and refund dark nodes", async () => {
        // Deregister
        await dnr.deregister(ID("3"), { from: accounts[2] });
        await dnr.deregister(ID("4"), { from: accounts[3] });
        await dnr.deregister(ID("7"), { from: accounts[6] });
        await dnr.deregister(ID("8"), { from: accounts[7] });

        (await dnr.isPendingDeregistration(ID("3"))).should.be.true;
        (await dnr.isPendingDeregistration(ID("4"))).should.be.true;
        (await dnr.isPendingDeregistration(ID("7"))).should.be.true;
        (await dnr.isPendingDeregistration(ID("8"))).should.be.true;

        // Call epoch
        await waitForEpoch(dnr);

        (await dnr.isRegisteredInPreviousEpoch(ID("3"))).should.be.true;
        (await dnr.isRegisteredInPreviousEpoch(ID("4"))).should.be.true;
        (await dnr.isRegisteredInPreviousEpoch(ID("7"))).should.be.true;
        (await dnr.isRegisteredInPreviousEpoch(ID("8"))).should.be.true;
        (await dnr.isDeregistered(ID("3"))).should.be.true;
        (await dnr.isDeregistered(ID("4"))).should.be.true;
        (await dnr.isDeregistered(ID("7"))).should.be.true;
        (await dnr.isDeregistered(ID("8"))).should.be.true;
        const previousDarknodesEpoch1 = (await dnr.getPreviousDarknodes(NULL, 0)).filter((x) => x !== NULL);
        await waitForEpoch(dnr);
        const previousDarknodesEpoch2 = (await dnr.getPreviousDarknodes(NULL, 0)).filter((x) => x !== NULL);
        (previousDarknodesEpoch1.length - previousDarknodesEpoch2.length).should.be.equal(4);
        (await dnr.isDeregistered(ID("3"))).should.be.true;
        (await dnr.isDeregistered(ID("4"))).should.be.true;
        (await dnr.isDeregistered(ID("7"))).should.be.true;
        (await dnr.isDeregistered(ID("8"))).should.be.true;

        // Refund
        await dnr.refund(ID("3"), { from: accounts[2] });
        await dnr.refund(ID("4"), { from: accounts[3] });
        await dnr.refund(ID("7"), { from: accounts[6] });
        await dnr.refund(ID("8"), { from: accounts[7] });

        (await dnr.isRefunded(ID("3"))).should.be.true;
        (await dnr.isRefunded(ID("4"))).should.be.true;
        (await dnr.isRefunded(ID("7"))).should.be.true;
        (await dnr.isRefunded(ID("8"))).should.be.true;
        (await ren.balanceOf(accounts[2])).should.bignumber.equal(MINIMUM_BOND);
        (await ren.balanceOf(accounts[3])).should.bignumber.equal(MINIMUM_BOND);
        (await ren.balanceOf(accounts[6])).should.bignumber.equal(MINIMUM_BOND);
        (await ren.balanceOf(accounts[7])).should.bignumber.equal(MINIMUM_BOND);
    });

    it("anyone can refund", async () => {
        const owner = accounts[2];
        const id = ID("3");
        const pubk = PUBK("3");

        // [SETUP] Register and then deregister nodes
        await ren.approve(dnr.address, MINIMUM_BOND, { from: owner });
        await dnr.register(id, pubk, MINIMUM_BOND, { from: owner });
        await waitForEpoch(dnr);
        await dnr.deregister(id, { from: owner });
        (await dnr.isPendingDeregistration(id)).should.be.true;
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);

        // [ACTION] Refund
        await dnr.refund(id, { from: accounts[0] });

        // [CHECK] Refund was successful and bond was returned
        (await dnr.isRefunded(id)).should.be.true;
        (await ren.balanceOf(owner)).should.bignumber.equal(MINIMUM_BOND);
    });

    it("should fail to refund twice", async () => {
        await dnr.refund(ID("3")).should.be.rejectedWith(null, /must be deregistered for at least one epoch/);
    });

    it("should throw if refund fails", async () => {
        // [SETUP]
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[0] });
        await dnr.register(ID("3"), PUBK("3"), MINIMUM_BOND);
        await waitForEpoch(dnr);
        await dnr.deregister(ID("3"));
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);

        // [CHECK] Refund fails if transfer fails
        await ren.pause();
        await dnr.refund(ID("3")).should.be.rejectedWith(null, /revert/); // paused contract
        await ren.unpause();

        // [RESET]
        await dnr.refund(ID("3"));
    });

    it("should not refund for an address which is never registered", async () => {
        await dnr.refund(ID("-1")).should.be.rejectedWith(null, /must be deregistered for at least one epoch/);
    });

    it("can update slasher address", async () => {
        // [CHECK] This test assumes different previous and new slashers
        const previousSlasher = await dnr.slasher();
        const newSlasher = accounts[3];
        previousSlasher.should.not.equal(newSlasher);

        // [CHECK] The slasher can't be updated to 0x0
        await dnr.updateSlasher(NULL)
            .should.be.rejectedWith(null, "invalid slasher address");

        // [ACTION] Update slasher address
        await dnr.updateSlasher(newSlasher);
        // [CHECK] Verify the address hasn't changed before an epoch
        (await dnr.slasher()).should.equal(previousSlasher);

        // [CHECK] Verify the new slasher address after an epoch
        await waitForEpoch(dnr);
        (await dnr.slasher()).should.equal(newSlasher);

        // [RESET] Reset the slasher address to the previous slasher address
        await dnr.updateSlasher(previousSlasher);
        await waitForEpoch(dnr);
        (await dnr.slasher()).should.equal(previousSlasher);
    });

    it("anyone except the slasher can not call slash", async () => {
        // [SETUP] Set slasher to accounts[3]
        const previousSlasher = await dnr.slasher();
        const slasher = accounts[3];
        await dnr.updateSlasher(slasher);

        // [SETUP] Register darknodes 3, 4, 7 and 8
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[2] });
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[3] });
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[6] });
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[7] });
        await dnr.register(ID("3"), PUBK("3"), MINIMUM_BOND, { from: accounts[2] });
        await dnr.register(ID("4"), PUBK("4"), MINIMUM_BOND, { from: accounts[3] });
        await dnr.register(ID("7"), PUBK("7"), MINIMUM_BOND, { from: accounts[6] });
        await dnr.register(ID("8"), PUBK("8"), MINIMUM_BOND, { from: accounts[7] });
        await waitForEpoch(dnr);
        await dnr.deregister(ID("4"), { from: accounts[3] });
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);

        // [CHECK] Only the slasher can call `slash`
        await dnr.slash(ID("3"), ID("7"), ID("8"), { from: accounts[4] })
            .should.be.rejectedWith(null, /must be slasher/);
        await dnr.slash(ID("3"), ID("7"), ID("8"), { from: slasher });
        await dnr.slash(ID("4"), ID("7"), ID("8"), { from: slasher });

        // [RESET] Reset slasher to the slasher contract
        await dnr.updateSlasher(previousSlasher);
    });

    it("transfer ownership of the dark node store", async () => {
        // [ACTION] Initiate ownership transfer to wrong account
        await dnr.transferStoreOwnership(accounts[1]);

        // [ACTION] Can correct ownership transfer
        await dnr.transferStoreOwnership(accounts[0]);

        // [CHECK] Owner should still be the DNR
        (await dnrs.owner()).should.equal(dnr.address);

        // [ACTION] Claim ownership
        await dnrs.claimOwnership();

        // [CHECK] Owner should now be main account
        (await dnrs.owner()).should.equal(accounts[0]);

        // [RESET] Initiate ownership transfer back to DNR
        await dnrs.transferOwnership(dnr.address);

        // [CHECK] Owner should still be main account
        (await dnrs.owner()).should.equal(accounts[0]);

        // [RESET] Claim ownership
        await dnr.claimStoreOwnership();

        // [CHECK] Owner should now be the DNR
        (await dnrs.owner()).should.equal(dnr.address);
    });

    it("can't arbitrarily increase bond", async () => {
        // [SETUP] Transfer store to main account
        await dnr.transferStoreOwnership(accounts[0]);
        await dnrs.claimOwnership();

        const previousRenBalance = new BN(await ren.balanceOf(accounts[0]));

        // [ACTION] Decrease bond (used for bond slashing)
        const difference = new BN(1);
        const previousBond = new BN(await dnrs.darknodeBond(ID("7")));
        await dnrs.updateDarknodeBond(ID("7"), previousBond.sub(difference));

        // [CHECK] Decreasing bond transfers different to owner
        const afterRenBalance = new BN(await ren.balanceOf(accounts[0]));
        afterRenBalance.sub(previousRenBalance).should.be.bignumber.equal(difference);

        // [CHECK] Can't increase bond again
        await dnrs.updateDarknodeBond(ID("7"), previousBond)
            .should.be.rejectedWith(null, /bond not decreased/);

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
            .should.be.rejectedWith(null, /revert/);

        // [RESET] Unpause REN
        await ren.unpause();

        // [RESET] Transfer store back to DNR
        await dnrs.transferOwnership(dnr.address);
        await dnr.claimStoreOwnership();
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
            process.stdout.write(`\rRegistering Darknode #${i + 1}`);

            await dnr.register(ID(`${i + 1}`), PUBK(`${i + 1}`), MINIMUM_BOND);
        }

        console.log("");

        await waitForEpoch(dnr);

        let start = NULL;
        do {
            const nodes = await dnr.getDarknodes(start, 50);
            console.log(nodes);
            start = nodes[nodes.length - 1];
        } while (start !== NULL);

        const numDarknodes = await dnr.numDarknodes();
        numDarknodes.should.bignumber.equal(MAX_DARKNODES);

        for (let i = 0; i < MAX_DARKNODES; i++) {
            process.stdout.write(`\rDeregistering Darknode #${i + 1}`);
            await dnr.deregister(ID(`${i + 1}`));
        }

        console.log("");

        await waitForEpoch(dnr);
        await waitForEpoch(dnr);

        for (let i = 0; i < MAX_DARKNODES; i++) {
            process.stdout.write(`\rRefunding Darknode #${i + 1}`);
            await dnr.refund(ID(`${i + 1}`));
        }

        console.log("");
    });

});
