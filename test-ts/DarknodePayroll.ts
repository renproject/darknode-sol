import { BN } from "bn.js";

import {
    MINIMUM_BOND, PUBK, waitForEpoch, increaseTime,
} from "./helper/testUtils";


import { DarknodePaymentArtifact, DarknodePaymentContract } from "./bindings/darknode_payment";
import { DarknodeRegistryArtifact, DarknodeRegistryContract } from "./bindings/darknode_registry";
import { DarknodePayrollArtifact, DarknodePayrollContract } from "./bindings/darknode_payroll";
import { ERC20Artifact, ERC20Contract } from "./bindings/erc20";
import { RepublicTokenArtifact, RepublicTokenContract } from "./bindings/republic_token";

import { DARKNODE_PAYMENT_CYCLE_DURATION } from "../migrations/config";

const RepublicToken = artifacts.require("RepublicToken") as RepublicTokenArtifact;
const ERC20 = artifacts.require("DAIToken") as ERC20Artifact;
const DarknodePayment = artifacts.require("DarknodePayment") as DarknodePaymentArtifact;
const DarknodePayroll = artifacts.require("DarknodePayroll") as DarknodePayrollArtifact;
const DarknodeRegistry = artifacts.require("DarknodeRegistry") as DarknodeRegistryArtifact;

const hour = 60 * 60;
const day = 24 * hour;

const CYCLE_DURATION = DARKNODE_PAYMENT_CYCLE_DURATION * day;

contract("DarknodePayroll", (accounts: string[]) => {

    let dnp: DarknodePaymentContract;
    let dai: ERC20Contract;
    let dnr: DarknodeRegistryContract;
    let dnj: DarknodePayrollContract;
    let ren: RepublicTokenContract;

    const owner = accounts[0];
    const darknode1 = accounts[1];
    const darknode2 = accounts[2];
    const darknode3 = accounts[3];

    before(async () => {
        ren = await RepublicToken.deployed();
        dai = await ERC20.deployed();
        dnr = await DarknodeRegistry.deployed();
        dnp = await DarknodePayment.deployed();
        dnj = await DarknodePayroll.deployed();

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

        new BN(await dnj.whitelistTotal()).should.bignumber.equal(new BN(0));
    });

    afterEach(async () => {
        await waitForCycle();
    });

    it("cannot blacklist invalid addresses", async () => {
        const invalidAddress = "0x0"
        await dnj.isBlacklisted(invalidAddress).should.eventually.be.false;
        await dnp.blacklist(invalidAddress).should.be.rejectedWith(null, /not a registered darknode/);
        await dnj.isBlacklisted(owner).should.eventually.be.false;
        await dnp.blacklist(owner).should.be.rejectedWith(null, /not a registered darknode/);
    })

    it("cannot transfer contract ownership to an invalid addresses", async () => {
        const invalidAddress = "0x0"
        await dnj.updateDarknodePayment(invalidAddress).should.be.rejectedWith(null, /invalid contract address/);
    })

    it("should reject white/blacklist attempts from non-DNP contract", async () => {
        await dnj.isBlacklisted(darknode1).should.eventually.be.false;
        await dnj.blacklist(darknode1).should.be.rejectedWith(null, /not DarknodePayment contract/);
        await dnj.isBlacklisted(darknode1).should.eventually.be.false;
        await dnj.isWhitelisted(darknode1).should.eventually.be.false;
        await dnj.whitelist(darknode1, new BN(1)).should.be.rejectedWith(null, /not DarknodePayment contract/);
        await dnj.isWhitelisted(darknode1).should.eventually.be.false;
    })

    it("can blacklist darknodes", async () => {
        await dnj.isBlacklisted(darknode1).should.eventually.be.false;
        await dnp.blacklist(darknode1);
        await dnj.isBlacklisted(darknode1).should.eventually.be.true;
    })

    it("cannot blacklist already blacklisted darknodes", async () => {
        await dnj.isBlacklisted(darknode1).should.eventually.be.true;
        await dnp.blacklist(darknode1).should.be.rejectedWith(null, /already blacklisted/);
        await dnj.isBlacklisted(darknode1).should.eventually.be.true;
    })

    it("cannot whitelist blacklisted darknodes", async () => {
        await dnj.isBlacklisted(darknode1).should.eventually.be.true;
        await dnp.blacklist(darknode1).should.be.rejectedWith(null, /already blacklisted/);
        await dnp.whitelist(darknode1).should.be.rejectedWith(null, /darknode is blacklisted/);
    })

    it("can unblacklist blacklisted darknodes", async () => {
        await dnj.isBlacklisted(darknode1).should.eventually.be.true;
        await dnp.unBlacklist(darknode1).should.not.be.rejectedWith(null, /not in blacklist/);
        await dnj.isBlacklisted(darknode1).should.eventually.be.false;
    })

    it("cannot unblacklist non-blacklisted darknodes", async () => {
        await dnj.isBlacklisted(darknode1).should.eventually.be.false;
        await dnp.unBlacklist(darknode1).should.be.rejectedWith(null, /not in blacklist/);
    })

    it("can whitelist darknodes", async () => {
        await waitForCycle();
        new BN(await dnj.whitelistTotal()).should.bignumber.equal(new BN(0));
        await dnj.isWhitelisted(darknode2).should.eventually.be.false;
        await dnp.whitelist(darknode2);
        await dnj.isWhitelisted(darknode2).should.eventually.be.true;
        await waitForCycle();
        new BN(await dnj.whitelistTotal()).should.bignumber.equal(new BN(1));
    })

    it("cannot whitelist already whitelisted darknodes", async () => {
        new BN(await dnj.whitelistTotal()).should.bignumber.equal(new BN(1));
        await dnj.isWhitelisted(darknode2).should.eventually.be.true;
        await dnp.whitelist(darknode2).should.be.rejectedWith(null, /already whitelisted/);
    })

    const waitForCycle = async (seconds=CYCLE_DURATION) => {
        const numEpochs = Math.floor(seconds / (1 * day));
        await increaseTime(seconds);
        for (let i = 0; i < numEpochs; i++) {
            await waitForEpoch(dnr);
        }
        await dnp.fetchAndUpdateCurrentCycle();
    }

});
