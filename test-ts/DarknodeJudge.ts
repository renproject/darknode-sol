import { BN } from "bn.js";

import {
    MINIMUM_BOND, PUBK, waitForEpoch, increaseTime,
} from "./helper/testUtils";


import { DarknodePaymentArtifact, DarknodePaymentContract } from "./bindings/darknode_payment";
import { DarknodeRegistryArtifact, DarknodeRegistryContract } from "./bindings/darknode_registry";
import { DarknodeJudgeArtifact, DarknodeJudgeContract } from "./bindings/darknode_judge";
import { ERC20Artifact, ERC20Contract } from "./bindings/erc20";
import { RepublicTokenArtifact, RepublicTokenContract } from "./bindings/republic_token";

import { DARKNODE_PAYMENT_CYCLE_DURATION } from "../migrations/config";

const RepublicToken = artifacts.require("RepublicToken") as RepublicTokenArtifact;
const ERC20 = artifacts.require("DAIToken") as ERC20Artifact;
const DarknodePayment = artifacts.require("DarknodePayment") as DarknodePaymentArtifact;
const DarknodeJudge = artifacts.require("DarknodeJudge") as DarknodeJudgeArtifact;
const DarknodeRegistry = artifacts.require("DarknodeRegistry") as DarknodeRegistryArtifact;

const hour = 60 * 60;
const day = 24 * hour;

const CYCLE_DURATION = DARKNODE_PAYMENT_CYCLE_DURATION * day;

contract("DarknodeJudge", (accounts: string[]) => {

    let dnp: DarknodePaymentContract;
    let dai: ERC20Contract;
    let dnr: DarknodeRegistryContract;
    let dnj: DarknodeJudgeContract;
    let ren: RepublicTokenContract;

    const darknode1 = accounts[1];
    const darknode2 = accounts[2];
    const darknode3 = accounts[3];

    before(async () => {
        ren = await RepublicToken.deployed();
        dai = await ERC20.deployed();
        dnr = await DarknodeRegistry.deployed();
        dnp = await DarknodePayment.deployed();
        dnj = await DarknodeJudge.deployed();

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

    it("can blacklist darknodes", async () => {
        dnj.isBlacklisted(darknode1).should.eventually.be.false;
        await dnp.blacklist(darknode1);
        dnj.isBlacklisted(darknode1).should.eventually.be.true;
    })

    it("cannot blacklist already blacklisted darknodes", async () => {
        dnj.isBlacklisted(darknode1).should.eventually.be.true;
        await dnp.blacklist(darknode1).should.be.rejectedWith(null, /already blacklisted/);
    })

    it("cannot whitelist blacklisted darknodes", async () => {
        dnj.isBlacklisted(darknode1).should.eventually.be.true;
        await dnp.blacklist(darknode1).should.be.rejectedWith(null, /already blacklisted/);
        await dnp.whitelist(darknode1).should.be.rejectedWith(null, /darknode is blacklisted/);
    })

    it("can whitelist darknodes", async () => {
        await waitForCycle();
        new BN(await dnj.whitelistTotal()).should.bignumber.equal(new BN(0));
        dnj.isWhitelisted(darknode2).should.eventually.be.false;
        await dnp.whitelist(darknode2);
        dnj.isWhitelisted(darknode2).should.eventually.be.true;
        await waitForCycle();
        new BN(await dnj.whitelistTotal()).should.bignumber.equal(new BN(1));
    })

    it("cannot whitelist already whitelisted darknodes", async () => {
        new BN(await dnj.whitelistTotal()).should.bignumber.equal(new BN(1));
        dnj.isWhitelisted(darknode2).should.eventually.be.true;
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
