import {
    BTCGatewayInstance, DarknodePaymentInstance, DarknodePaymentStoreInstance,
    DarknodeRegistryInstance, DarknodeRegistryStoreInstance, DarknodeSlasherInstance,
    GatewayRegistryInstance, ProtocolLogicInstance, ProtocolProxyInstance, renBTCInstance,
    RenTokenInstance,
} from "../types/truffle-contracts";
import { encodeCallData, NULL, waitForEpoch } from "./helper/testUtils";

const DarknodePayment = artifacts.require("DarknodePayment");
const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const RenToken = artifacts.require("RenToken");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");
const GatewayRegistry = artifacts.require("GatewayRegistry");
const renBTC = artifacts.require("renBTC");
const BTCGateway = artifacts.require("BTCGateway");
const ProtocolProxy = artifacts.require("ProtocolProxy");
const ProtocolLogic = artifacts.require("ProtocolLogic");

contract("Protocol", ([owner, proxyGovernanceAddress, otherAccount]: string[]) => {

    let dnp: DarknodePaymentInstance;
    let dnpStore: DarknodePaymentStoreInstance;
    let ren: RenTokenInstance;
    let dnrs: DarknodeRegistryStoreInstance;
    let dnr: DarknodeRegistryInstance;
    let slasher: DarknodeSlasherInstance;
    let gatewayRegistry: GatewayRegistryInstance;
    let renbtc: renBTCInstance;
    let btcGateway: BTCGatewayInstance;
    let protocol: ProtocolLogicInstance;
    let protocolProxy: ProtocolProxyInstance;

    before(async () => {
        ren = await RenToken.deployed();
        dnrs = await DarknodeRegistryStore.deployed();
        dnr = await DarknodeRegistry.deployed();
        dnp = await DarknodePayment.deployed();
        dnpStore = await DarknodePaymentStore.deployed();
        slasher = await DarknodeSlasher.deployed();
        gatewayRegistry = await GatewayRegistry.deployed();
        renbtc = await renBTC.deployed();
        btcGateway = await BTCGateway.deployed();
        protocol = await ProtocolLogic.at(ProtocolProxy.address);
        protocolProxy = await ProtocolProxy.deployed();
        await waitForEpoch(dnr);
    });

    it("Address getters", async () => {
        (await protocol.renToken.call())
            .should.equal(ren.address);

        (await protocol.darknodeRegistry.call())
            .should.equal(dnr.address);

        (await protocol.darknodeRegistryStore.call())
            .should.equal(dnrs.address);

        (await protocol.darknodePayment.call())
            .should.equal(dnp.address);

        (await protocol.darknodePaymentStore.call())
            .should.equal(dnpStore.address);

        (await protocol.darknodeSlasher.call())
            .should.equal(slasher.address);

        (await protocol.gatewayRegistry.call())
            .should.equal(gatewayRegistry.address);
    });

    it("Protocol owner", async () => {
        (await protocol.owner.call())
            .should.equal(owner);

        await protocol.transferOwnership(otherAccount, { from: otherAccount })
            .should.be.rejectedWith(/Ownable: caller is not the owner/);

        await protocol.transferOwnership(otherAccount);

        (await protocol.owner.call())
            .should.equal(owner);

        await protocol.claimOwnership({ from: otherAccount });

        (await protocol.owner.call())
            .should.equal(otherAccount);

        await protocol.transferOwnership(owner, { from: otherAccount });
        await protocol.claimOwnership({ from: owner });

        (await protocol.owner.call())
            .should.equal(owner);
    });

    it("Update DarknodeRegistry address", async () => {
        await protocol._updateDarknodeRegistry(NULL, { from: otherAccount })
            .should.be.rejectedWith(/Ownable: caller is not the owner/);

        await protocol._updateDarknodeRegistry(NULL);

        (await protocol.darknodeRegistry.call())
            .should.equal(NULL);

        await protocol._updateDarknodeRegistry(dnr.address);

        (await protocol.darknodeRegistry.call())
            .should.equal(dnr.address);
    });

    it("Update GatewayRegistry address", async () => {
        await protocol._updateGatewayRegistry(NULL, { from: otherAccount })
            .should.be.rejectedWith(/Ownable: caller is not the owner/);

        await protocol._updateGatewayRegistry(NULL);

        (await protocol.gatewayRegistry.call())
            .should.equal(NULL);

        await protocol._updateGatewayRegistry(gatewayRegistry.address);

        (await protocol.gatewayRegistry.call())
            .should.equal(gatewayRegistry.address);
    });

    it("Proxy functions", async () => {
        // Try to initialize again
        await protocolProxy.initialize(
            ProtocolLogic.address,
            proxyGovernanceAddress,
            encodeCallData(web3, "initialize", ["address"], [owner]), { from: proxyGovernanceAddress },
        )
            .should.be.rejectedWith(/revert$/);
        await protocolProxy.initialize(
            ProtocolLogic.address,
            proxyGovernanceAddress,
            Buffer.from([]) as unknown as string,
        )
            .should.be.rejectedWith(/revert$/);

        // Upgrade logic
        const newLogic = await ProtocolLogic.new();

        // Wrong address
        await protocolProxy.upgradeTo(newLogic.address, { from: owner })
            .should.be.rejectedWith(/revert$/);

        await protocolProxy.upgradeTo(newLogic.address, { from: proxyGovernanceAddress });
        (await protocol.renToken.call())
            .should.equal(ren.address);
    });

    it("Gateway functions", async () => {

        (await gatewayRegistry.getGatewayByToken.call(renbtc.address))
            .should.equal(btcGateway.address);

        (await protocol.getGatewayByToken.call(renbtc.address))
            .should.equal(btcGateway.address);

        (await protocol.getGatewayBySymbol.call("renBTC"))
            .should.equal(btcGateway.address);

        (await protocol.getTokenBySymbol.call("renBTC"))
            .should.equal(renbtc.address);

        { // The first 10 gateways starting from NULL
            const gateways = await protocol.getGateways.call(NULL, 10);
            gateways[0].should.equal(btcGateway.address);
            gateways[9].should.equal(NULL);
            gateways.length.should.equal(10);

            const renTokens = await protocol.getRenTokens.call(NULL, 10);
            renTokens[0].should.equal(renbtc.address);
            renTokens[9].should.equal(NULL);
            renTokens.length.should.equal(10);
        }

        { // Get all the gateways starting from NULL
            const gateways = await protocol.getGateways.call(NULL, 0);
            gateways[0].should.equal(btcGateway.address);
            gateways.length.should.equal(3);

            const renTokens = await protocol.getRenTokens.call(NULL, 0);
            renTokens[0].should.equal(renbtc.address);
            renTokens.length.should.equal(3);
        }

        { // Starting from first entry
            const gateways = await protocol.getGateways.call(btcGateway.address, 10);
            gateways[0].should.equal(btcGateway.address);
            gateways[9].should.equal(NULL);
            gateways.length.should.equal(10);

            const renTokens = await protocol.getRenTokens.call(renbtc.address, 10);
            renTokens[0].should.equal(renbtc.address);
            renTokens[9].should.equal(NULL);
            renTokens.length.should.equal(10);
        }

        { // Get all the gateways starting from first entry
            const gateways = await gatewayRegistry.getGateways.call(btcGateway.address, 0);
            gateways[0].should.equal(btcGateway.address);
            gateways.length.should.equal(3);

            const renTokens = await gatewayRegistry.getRenTokens.call(renbtc.address, 0);
            renTokens[0].should.equal(renbtc.address);
            renTokens.length.should.equal(3);
        }
    });

});
