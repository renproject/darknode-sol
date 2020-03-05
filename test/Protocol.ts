import {
    BTCShifterInstance, DarknodePaymentInstance, DarknodePaymentStoreInstance,
    DarknodeRegistryInstance, DarknodeRegistryStoreInstance, DarknodeSlasherInstance,
    ProtocolInstance, ProtocolLogicInstance, RenTokenInstance, ShifterRegistryInstance,
    zBTCInstance,
} from "../types/truffle-contracts";
import { encodeCallData, NULL, waitForEpoch } from "./helper/testUtils";

const DarknodePayment = artifacts.require("DarknodePayment");
const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const RenToken = artifacts.require("RenToken");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");
const ShifterRegistry = artifacts.require("ShifterRegistry");
const zBTC = artifacts.require("zBTC");
const BTCShifter = artifacts.require("BTCShifter");
const Protocol = artifacts.require("Protocol");
const ProtocolLogic = artifacts.require("ProtocolLogic");

contract("Protocol", ([owner, proxyOwner, otherAccount]: string[]) => {

    let dnp: DarknodePaymentInstance;
    let dnps: DarknodePaymentStoreInstance;
    let ren: RenTokenInstance;
    let dnrs: DarknodeRegistryStoreInstance;
    let dnr: DarknodeRegistryInstance;
    let slasher: DarknodeSlasherInstance;
    let shifterRegistry: ShifterRegistryInstance;
    let zbtc: zBTCInstance;
    let btcShifter: BTCShifterInstance;
    let protocol: ProtocolLogicInstance;
    let protocolProxy: ProtocolInstance;

    before(async () => {
        ren = await RenToken.deployed();
        dnrs = await DarknodeRegistryStore.deployed();
        dnr = await DarknodeRegistry.deployed();
        dnp = await DarknodePayment.deployed();
        dnps = await DarknodePaymentStore.deployed();
        slasher = await DarknodeSlasher.deployed();
        shifterRegistry = await ShifterRegistry.deployed();
        zbtc = await zBTC.deployed();
        btcShifter = await BTCShifter.deployed();
        protocol = await ProtocolLogic.at(Protocol.address);
        protocolProxy = await Protocol.deployed();
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
            .should.equal(dnps.address);

        (await protocol.darknodeSlasher.call())
            .should.equal(slasher.address);

        (await protocol.shifterRegistry.call())
            .should.equal(shifterRegistry.address);
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

    it("Update ShifterRegistry address", async () => {
        await protocol._updateShifterRegistry(NULL, { from: otherAccount })
            .should.be.rejectedWith(/Ownable: caller is not the owner/);

        await protocol._updateShifterRegistry(NULL);

        (await protocol.shifterRegistry.call())
            .should.equal(NULL);

        await protocol._updateShifterRegistry(shifterRegistry.address);

        (await protocol.shifterRegistry.call())
            .should.equal(shifterRegistry.address);
    });

    it("Proxy functions", async () => {
        // Try to initialize again
        await protocolProxy.initialize(
            ProtocolLogic.address,
            proxyOwner,
            encodeCallData("initialize", ["address"], [owner]), { from: proxyOwner },
        )
            .should.be.rejectedWith(/revert$/);
        await protocolProxy.initialize(
            ProtocolLogic.address,
            proxyOwner,
            Buffer.from([]) as unknown as string,
        )
            .should.be.rejectedWith(/revert$/);

        // Upgrade logic
        const newLogic = await ProtocolLogic.new();

        // Wrong address
        await protocolProxy.upgradeTo(newLogic.address, { from: owner })
            .should.be.rejectedWith(/revert$/);

        await protocolProxy.upgradeTo(newLogic.address, { from: proxyOwner });
        (await protocol.renToken.call())
            .should.equal(ren.address);
    });

    it("Shifter functions", async () => {

        (await shifterRegistry.getShifterByToken.call(zbtc.address))
            .should.equal(btcShifter.address);

        (await protocol.getShifterByToken.call(zbtc.address))
            .should.equal(btcShifter.address);

        (await protocol.getShifterBySymbol.call("zBTC"))
            .should.equal(btcShifter.address);

        (await protocol.getTokenBySymbol.call("zBTC"))
            .should.equal(zbtc.address);

        { // The first 10 shifters starting from NULL
            const shifters = await protocol.getShifters.call(NULL, 10);
            shifters[0].should.equal(btcShifter.address);
            shifters[9].should.equal(NULL);
            shifters.length.should.equal(10);

            const shiftedTokens = await protocol.getShiftedTokens.call(NULL, 10);
            shiftedTokens[0].should.equal(zbtc.address);
            shiftedTokens[9].should.equal(NULL);
            shiftedTokens.length.should.equal(10);
        }

        { // Get all the shifters starting from NULL
            const shifters = await protocol.getShifters.call(NULL, 0);
            shifters[0].should.equal(btcShifter.address);
            shifters.length.should.equal(3);

            const shiftedTokens = await protocol.getShiftedTokens.call(NULL, 0);
            shiftedTokens[0].should.equal(zbtc.address);
            shiftedTokens.length.should.equal(3);
        }

        { // Starting from first entry
            const shifters = await protocol.getShifters.call(btcShifter.address, 10);
            shifters[0].should.equal(btcShifter.address);
            shifters[9].should.equal(NULL);
            shifters.length.should.equal(10);

            const shiftedTokens = await protocol.getShiftedTokens.call(zbtc.address, 10);
            shiftedTokens[0].should.equal(zbtc.address);
            shiftedTokens[9].should.equal(NULL);
            shiftedTokens.length.should.equal(10);
        }

        { // Get all the shifters starting from first entry
            const shifters = await shifterRegistry.getShifters.call(btcShifter.address, 0);
            shifters[0].should.equal(btcShifter.address);
            shifters.length.should.equal(3);

            const shiftedTokens = await shifterRegistry.getShiftedTokens.call(zbtc.address, 0);
            shiftedTokens[0].should.equal(zbtc.address);
            shiftedTokens.length.should.equal(3);
        }
    });

});
