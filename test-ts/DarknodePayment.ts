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

    before(async () => {
        ren = await RepublicToken.deployed();
        dai = await ERC20.deployed();
        dnr = await DarknodeRegistry.deployed();
        dnp = await DarknodePayment.deployed();

        // [ACTION] Register
        for (let i = 0; i < accounts.length; i++) {
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
        const previousBalance = new BN(await dnp.balance());

        // Approve the contract to use DAI
        const amount = new BN("100000000000000000");
        await dai.approve(dnp.address, amount);
        await dnp.deposit(amount);
        // We should expect the DAI balance to have increased by what we deposited
        (await dnp.balance()).should.bignumber.equal(previousBalance.add(amount));
    });

    it("cannot withdraw if there is no balance", async () => {
        await dnp.withdraw().should.be.rejectedWith(null, /nothing to withdraw/);
    })

});
