import {
    NULL, randomAddress,
} from "./helper/testUtils";

import {
    SettlementRegistryArtifact,
    SettlementRegistryContract,
    SettlementRegistryEvents,
} from "./bindings/settlement_registry";

import * as Web3 from "web3";

import { TestHelper } from "zos";

import * as deployRepublicProtocolContracts from "../migrations/deploy";

const fixWeb3 = require("../migrations/fixWeb3");
const defaultConfig = require("../migrations/config");

contract("SettlementRegistry", (accounts: string[]) => {

    const proxyOwner = accounts[9];
    const contractOwner = accounts[8];

    let settlementRegistry: SettlementRegistryContract;

    before(async () => {
        fixWeb3(web3, artifacts);
        this.app = await TestHelper({ from: proxyOwner, gasPrice: 10000000000 });
        const config = { ...defaultConfig, CONTRACT_OWNER: contractOwner };
        ({ settlementRegistry } = await deployRepublicProtocolContracts(artifacts, this.app, config));
    });

    it("can register a settlement", async () => {
        const id = 0x1;
        const settlement = randomAddress();
        const verifier = randomAddress();

        // [CHECK] Should not be registered
        (await settlementRegistry.settlementRegistration(id))
            .should.be.false;

        // [ACTION] Register Settlement
        (await settlementRegistry.registerSettlement(id, settlement, verifier, { from: contractOwner }))
            .should.emit.logs([
                SettlementRegistryEvents.LogSettlementRegistered(id, settlement, verifier),
            ]);

        // [CHECK] Check details after registration
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

        // [CHECK] Not registered yet
        await settlementRegistry.deregisterSettlement(id, { from: contractOwner })
            .should.be.rejectedWith(null, /not registered/);

        // [ACTION] Register Settlement
        await settlementRegistry.registerSettlement(id, settlement, verifier, { from: contractOwner });
        // [ACTION] Deregister Settlement
        (await settlementRegistry.deregisterSettlement(id, { from: contractOwner }))
            .should.emit.logs([
                SettlementRegistryEvents.LogSettlementDeregistered(id),
            ]);

        // [CHECK] Check details after deregistration
        const details = await settlementRegistry.settlementDetails(id, { from: accounts[1] });

        details/*.registered*/[0].should.be.false;
        details/*.settlementContract*/[1].should.address.equal(NULL);
        details/*.brokerVerifierContract*/[2].should.address.equal(NULL);
    });

    it("can update a settlement", async () => {
        const id = 0x3;
        const settlement = randomAddress();
        const verifier = randomAddress();

        // [SETUP] Register Settlement
        await settlementRegistry.registerSettlement(id, settlement, verifier, { from: contractOwner });

        // [ACTION] Update Settlement
        const newVerifier = randomAddress();
        (await settlementRegistry.registerSettlement(id, settlement, newVerifier, { from: contractOwner }))
            .should.emit.logs([
                SettlementRegistryEvents.LogSettlementUpdated(id, settlement, newVerifier),
            ]);

        // [CHECK] Check details after updating
        const details = await settlementRegistry.settlementDetails(id);
        details/*.registered*/[0].should.be.true;
        details/*.settlementContract*/[1].should.address.equal(settlement);
        details/*.brokerVerifierContract*/[2].should.address.equal(newVerifier);
    });

    it("only the owner can register and deregister", async () => {
        const id = 0x3;
        const settlement = randomAddress();
        const verifier = randomAddress();

        // [CHECK]
        await settlementRegistry.registerSettlement(id, settlement, verifier, { from: accounts[2] })
            .should.be.rejectedWith(null, /revert/); // not owner

        // [ACTION]
        await settlementRegistry.registerSettlement(id, settlement, verifier, { from: contractOwner });

        // [CHECK]
        await settlementRegistry.deregisterSettlement(id, { from: accounts[2] })
            .should.be.rejectedWith(null, /revert/); // not owner

        // [ACTION]
        await settlementRegistry.deregisterSettlement(id, { from: contractOwner });
    });
});
