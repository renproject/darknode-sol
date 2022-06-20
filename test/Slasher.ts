import BN from "bn.js";

import {
    DarknodeRegistryLogicV3Instance,
    DarknodeRegistryStoreInstance,
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
const Slasher = artifacts.require("Slasher");

const { config } = require("../migrations/networks");

const numAccounts = 10;

contract("DarknodeRegistry", (accounts: string[]) => {
    let ren: RenTokenInstance;
    let dnrs: DarknodeRegistryStoreInstance;
    let dnr: DarknodeRegistryLogicV3Instance;
    let proxyAdmin: RenProxyAdminInstance;
    let slasher: SlasherInstance;

    before(async () => {
        slasher = await Slasher.deployed();
        ren = await RenToken.deployed();
        dnrs = await DarknodeRegistryStore.deployed();
        const dnrProxy = await DarknodeRegistryProxy.deployed();
        dnr = await DarknodeRegistryLogicV3.at(dnrProxy.address);
        proxyAdmin = await RenProxyAdmin.deployed();
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
    // it("should be able to challenge a darknode", async () => {


    // });
});