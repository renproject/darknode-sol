import { BN } from "bn.js";

import {
    NULL, randomAddress,
} from "./helper/testUtils";

import {
    SettlementRegistryArtifact,
    SettlementRegistryContract,
    SettlementRegistryEvents,
} from "./bindings/settlement_registry";

const SettlementRegistry = artifacts.require("SettlementRegistry") as SettlementRegistryArtifact;

contract("DarknodeRegistry", (accounts: string[]) => {

    let settlementRegistry: SettlementRegistryContract;

    before(async () => {
        settlementRegistry = await SettlementRegistry.deployed();
    });

    it("can register a settlement", async () => {
        const id = 0x1;
        const settlement = randomAddress();
        const verifier = randomAddress();

        // Should not be registered
        (await settlementRegistry.settlementRegistration(id))
            .should.be.false;

        // Register Settlement
        (await settlementRegistry.registerSettlement(id, settlement, verifier) as any)
            .should.emit.logs([
                SettlementRegistryEvents.LogSettlementRegistered(new BN(id), settlement, verifier),
            ]);

        // Check details after registration
        const details = await settlementRegistry.settlementDetails(id);

        details.registered.should.be.true;
        (await settlementRegistry.settlementRegistration(id))
            .should.be.true;

        details.settlementContract.should.equal(settlement);
        (await settlementRegistry.settlementContract(id))
            .should.equal(settlement);

        details.brokerVerifierContract.should.equal(verifier);
        (await settlementRegistry.brokerVerifierContract(id))
            .should.equal(verifier);
    });

    it("can deregister a settlement", async () => {
        const id = 0x2;
        const settlement = randomAddress();
        const verifier = randomAddress();

        // Not registered yet
        await settlementRegistry.deregisterSettlement(id)
            .should.be.rejectedWith(null, /note registered/);

        // Register Settlement
        await settlementRegistry.registerSettlement(id, settlement, verifier);
        // Deregister Settlement
        (await settlementRegistry.deregisterSettlement(id))
            .should.emit.logs([
                SettlementRegistryEvents.LogSettlementDeregistered(new BN(id)),
            ]);

        // Check details after deregistration
        const details = await settlementRegistry.settlementDetails(id);
        details.registered.should.be.false;
        details.settlementContract.should.equal(NULL);
        details.brokerVerifierContract.should.equal(NULL);
    });

    it("can update a settlement", async () => {
        const id = 0x3;
        const settlement = randomAddress();
        const verifier = randomAddress();

        // Register Settlement
        await settlementRegistry.registerSettlement(id, settlement, verifier);

        // Update Settlement
        const newVerifier = randomAddress();
        (await settlementRegistry.registerSettlement(id, settlement, newVerifier))
            .should.emit.logs([
                SettlementRegistryEvents.LogSettlementUpdated(new BN(id), settlement, newVerifier),
            ]);

        // Check details after updating
        const details = await settlementRegistry.settlementDetails(id);
        details.registered.should.be.true;
        details.settlementContract.should.equal(settlement);
        details.brokerVerifierContract.should.equal(newVerifier);
    });

    it("only the owner can register and deregister", async () => {
        const id = 0x3;
        const settlement = randomAddress();
        const verifier = randomAddress();

        await settlementRegistry.registerSettlement(id, settlement, verifier, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // not owner

        await settlementRegistry.registerSettlement(id, settlement, verifier);

        await settlementRegistry.deregisterSettlement(id, { from: accounts[1] })
            .should.be.rejectedWith(null, /revert/); // not owner

        await settlementRegistry.deregisterSettlement(id);
    });
});
