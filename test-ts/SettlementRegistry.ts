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
                SettlementRegistryEvents.LogSettlementRegistered(id, settlement, verifier),
            ]);

        // Check details after registration
        const details = await settlementRegistry.settlementDetails(id);

        details/*.registered*/[0].should.be.true;
        (await settlementRegistry.settlementRegistration(id))
            .should.be.true;

        details/*.settlementContract*/[1].should.address.equal(settlement);
        (await settlementRegistry.settlementContract(id))
            .should.address.equal(settlement);

        details/*.brokerVerifierContract*/[2].should.address.equal(verifier);
        (await settlementRegistry.brokerVerifierContract(id))
            .should.address.equal(verifier);
    });

    it("can deregister a settlement", async () => {
        const id = 0x2;
        const settlement = randomAddress();
        const verifier = randomAddress();

        // Not registered yet
        await settlementRegistry.deregisterSettlement(id)
            .should.be.rejectedWith(null, /not registered/);

        // Register Settlement
        await settlementRegistry.registerSettlement(id, settlement, verifier);
        // Deregister Settlement
        (await settlementRegistry.deregisterSettlement(id))
            .should.emit.logs([
                SettlementRegistryEvents.LogSettlementDeregistered(id),
            ]);

        // Check details after deregistration
        const details = await settlementRegistry.settlementDetails(id);
        details/*.registered*/[0].should.be.false;
        details/*.settlementContract*/[1].should.address.equal(NULL);
        details/*.brokerVerifierContract*/[2].should.address.equal(NULL);
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
                SettlementRegistryEvents.LogSettlementUpdated(id, settlement, newVerifier),
            ]);

        // Check details after updating
        const details = await settlementRegistry.settlementDetails(id);
        details/*.registered*/[0].should.be.true;
        details/*.settlementContract*/[1].should.address.equal(settlement);
        details/*.brokerVerifierContract*/[2].should.address.equal(newVerifier);
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
