const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const RepublicToken = artifacts.require("RepublicToken");

import {
    ID, PUBK, NULL, waitForEpoch,
    MINIMUM_BOND, MINIMUM_POD_SIZE, MINIMUM_EPOCH_INTERVAL,
} from "./helper/testUtils";

contract("DarknodeRegistry", function (accounts: string[]) {

    let ren, dnrs, dnr;

    before(async function () {
        ren = await RepublicToken.deployed();
        dnrs = await DarknodeRegistryStore.deployed();
        dnr = await DarknodeRegistry.deployed();

        for (let i = 1; i < accounts.length; i++) {
            await ren.transfer(accounts[i], MINIMUM_BOND);
        }
    });

    it("first epoch can only be called by the owner", async () => {
        await dnr.epoch({ from: accounts[1] }).should.be.rejectedWith(null, /not authorised/);
    });

    it("should return empty list when no darknodes are registered", async () => {
        let nodes = (await dnr.getPreviousDarknodes.call(NULL, 100)).filter((x) => x !== NULL);
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
        const lowBond = MINIMUM_BOND.minus(1);
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
        const nodes = (await dnr.getDarknodes.call(NULL, 0)).filter((x) => x !== NULL);
        (nodes.length).should.equal(accounts.length - 6);
        nodes[0].should.equal(ID("3"));
        nodes[1].should.equal(ID("4"));
        nodes[2].should.equal(ID("7"));
        nodes[3].should.equal(ID("8"));
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
            let newNodes = await dnr.getDarknodes.call(start, 2);
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
            let newNodes = await dnr.getPreviousDarknodes.call(start, 2);
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
        let previousDarknodesEpoch1 = (await dnr.getPreviousDarknodes(NULL, 0)).filter((x) => x !== NULL);
        await waitForEpoch(dnr);
        let previousDarknodesEpoch2 = (await dnr.getPreviousDarknodes(NULL, 0)).filter((x) => x !== NULL);
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

    it("should fail to refund twice", async () => {
        await dnr.refund(ID("3")).should.be.rejectedWith(null, /must be darknode owner/);
    });

    it("should throw if refund fails", async () => {
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[0] });
        await dnr.register(ID("3"), PUBK("3"), MINIMUM_BOND);
        await waitForEpoch(dnr);
        await dnr.deregister(ID("3"));
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);

        await ren.pause();
        await dnr.refund(ID("3")).should.be.rejectedWith(null, /revert/); // paused contract
        await ren.unpause();
        await dnr.refund(ID("3"));
    });

    it("should not refund for an address which is never registered", async () => {
        await dnr.refund(ID("-1")).should.be.rejectedWith(null, /must be darknode owner/);
    });

    it("anyone except the slasher can not call slash", async () => {
        const previousSlasher = await dnr.slasher();
        const slasher = accounts[3];
        await dnr.updateSlasher(slasher);

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
        await dnr.slash(ID("3"), ID("7"), ID("8"), { from: accounts[4] })
            .should.be.rejectedWith(null, /must be slasher/);
        await dnr.slash(ID("3"), ID("7"), ID("8"), { from: slasher });
        await dnr.slash(ID("4"), ID("7"), ID("8"), { from: slasher });

        await dnr.updateSlasher(previousSlasher);
    });

    it("transfer ownership of the dark node store", async () => {
        await dnr.transferStoreOwnership(accounts[0]);
        await dnrs.updateDarknodeBond(ID("7"), MINIMUM_BOND.multipliedBy(1000));
        await dnrs.updateDarknodeBond(ID("7"), MINIMUM_BOND)
            .should.be.rejectedWith(null, /revert/); // ren transfer error
        await dnrs.transferOwnership(dnr.address);
    });

    // Takes 30 minutes - keep as it.skip when not running
    it.skip("can register 6000 dark nodes", async () => {
        const MAX_DARKNODES = 6000;

        // Fund the darknode operator (6000 dark nodes cost a lot to operate!)
        for (let i = 1; i < accounts.length; i++) {
            const balance = await web3.eth.getBalance(accounts[i]);
            web3.eth.sendTransaction(
                { to: accounts[0], from: accounts[i], value: balance, gasPrice: 0 }
            );
        }

        await ren.approve(dnr.address, MINIMUM_BOND.multipliedBy(MAX_DARKNODES));

        for (let i = 0; i < MAX_DARKNODES; i++) {
            process.stdout.write(`\rRegistering Darknode #${i + 1}`);

            await dnr.register(ID(`${i + 1}`), PUBK(`${i + 1}`), MINIMUM_BOND);
        }

        console.log("");

        await waitForEpoch(dnr);

        let start = NULL;
        do {
            let nodes = await dnr.getDarknodes.call(start, 50);
            console.log(nodes);
            start = nodes[nodes.length - 1];
        } while (start !== NULL);

        const numDarknodes = await dnr.numDarknodes.call();
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
