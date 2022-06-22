import { signer } from "@openzeppelin/upgrades/lib/test/helpers/signing";
import BN from "bn.js";

import {
    DarknodeRegistryLogicV3Instance,
    DarknodeRegistryStoreInstance,
    TrueSignerVerifierInstance,
    RenProxyAdminInstance,
    RenTokenInstance,
    SlasherInstance
} from "../types/truffle-contracts";
import {
    deployProxy,
    ID,
    MINIMUM_BOND,
    MINIMUM_EPOCH_INTERVAL_SECONDS,
    MINIMUM_POD_SIZE,
    NULL,
    PUBK,
    waitForEpoch,
} from "./helper/testUtils";

const Claimer = artifacts.require("Claimer");
const ForceSend = artifacts.require("ForceSend");
const RenToken = artifacts.require("RenToken");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistryProxy = artifacts.require("DarknodeRegistryProxy");
const DarknodeRegistryLogicV3 = artifacts.require("DarknodeRegistryLogicV3");
const NormalToken = artifacts.require("NormalToken");
const RenProxyAdmin = artifacts.require("RenProxyAdmin");
const TrueSignerVerifier = artifacts.require("TrueSignerVerifier");
const FalseSignerVerifier = artifacts.require("FalseSignerVerifier");
const Slasher = artifacts.require("Slasher");

const { config } = require("../migrations/networks");

const numAccounts = 10;

contract("Slasher", (accounts: string[]) => {
    let ren: RenTokenInstance;
    let dnrs: DarknodeRegistryStoreInstance;
    let dnr: DarknodeRegistryLogicV3Instance;
    let proxyAdmin: RenProxyAdminInstance;
    let trueSlasher: SlasherInstance;
    let falseSlasher: SlasherInstance;

    const CHALLENGE_BOND = "1000";

    before(async () => {
        ren = await RenToken.deployed();
        dnrs = await DarknodeRegistryStore.deployed();
        const dnrProxy = await DarknodeRegistryProxy.deployed();
        dnr = await DarknodeRegistryLogicV3.at(dnrProxy.address);
        proxyAdmin = await RenProxyAdmin.deployed();
        const trueSV = await TrueSignerVerifier.new();
        const falseSV = await FalseSignerVerifier.new();
        trueSlasher = await Slasher.new(dnr.address, trueSV.address, CHALLENGE_BOND);
        falseSlasher = await Slasher.new(dnr.address, falseSV.address, CHALLENGE_BOND);

        await dnr
            .epoch({ from: accounts[1] })
            .should.be.rejectedWith(
                /DarknodeRegistry: not authorized to call first epoch/
            );
        await waitForEpoch(dnr);

        for (let i = 1; i < numAccounts; i++) {
            await ren.transfer(accounts[i], MINIMUM_BOND);
        }

        // Transfer accounts[numAccounts - 1] an additional MINIMUM_BOND so it can
        // register, deregister, and refund multiple darknodes
        await ren.transfer(accounts[numAccounts - 1], MINIMUM_BOND);
    });

    it("should not be able to challenge and slash a darknode with invalid signature", async () => {
        await dnr.updateSlasher(falseSlasher.address);
        await ren.approve(dnr.address, MINIMUM_BOND)
        await ren.approve(falseSlasher.address, MINIMUM_BOND)
        await dnr.registerNode(ID(2), 3);
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);
        const epochHash = await dnr.previousEpoch();
        await falseSlasher.challenge(1, `0x${epochHash[0].toString(16)}`);
        await falseSlasher
            .slash([ID(2)], [10], accounts[0], 1, `0x${epochHash[0].toString(16)}`, "0x")
            .should.be.rejectedWith(/Slasher: invalid signature/);
    });

    it("should not be able to challenge and slash a darknode with invalid params", async () => {
        await dnr.updateSlasher(trueSlasher.address);
        await ren.approve(dnr.address, MINIMUM_BOND)
        await ren.approve(trueSlasher.address, MINIMUM_BOND)
        await dnr.registerNode(ID(3), 3);
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);
        const epochHash = await dnr.previousEpoch();
        await trueSlasher.challenge(1, `0x${epochHash[0].toString(16)}`);
        await trueSlasher
            .slash([ID(3)], [], accounts[0], 1, `0x${epochHash[0].toString(16)}`, "0x")
            .should.be.rejectedWith(/Slasher: invalid slash params/);
    });

    it("should be able to challenge and slash a darknode", async () => {
        await dnr.updateSlasher(trueSlasher.address);
        await ren.approve(dnr.address, MINIMUM_BOND)
        await ren.approve(trueSlasher.address, MINIMUM_BOND)
        await dnr.registerNode(ID(1), 3);
        await waitForEpoch(dnr);
        await waitForEpoch(dnr);
        const epochHash = await dnr.previousEpoch();
        await trueSlasher.challenge(1, `0x${epochHash[0].toString(16)}`);
        await trueSlasher.slash([ID(1)], [10], accounts[0], 1, `0x${epochHash[0].toString(16)}`, "0x");
    });

    it("should not be able to slash twice for the same epoch", async () => {
        const epochHash = await dnr.previousEpoch();
        await trueSlasher
            .challenge(1, `0x${epochHash[0].toString(16)}`)
            .should.be.rejectedWith(/Slasher: this epoch has already been challenged/);
        await trueSlasher
            .slash([ID(1)], [10], accounts[0], 1, `0x${epochHash[0].toString(16)}`, "0x")
            .should.be.rejectedWith(/Slasher: this epoch has already been slashed/);
    });
});