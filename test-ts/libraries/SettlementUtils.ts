import { DarknodeRegistryArtifact, DarknodeRegistryContract } from "../bindings/darknode_registry";
import { RepublicTokenArtifact, RepublicTokenContract } from "../bindings/republic_token";
import { SettlementUtilsTestArtifact, SettlementUtilsTestContract } from "../bindings/settlement_utils_test";

import { MINIMUM_BOND, PUBK, waitForEpoch } from "../helper/testUtils";

const SettlementUtilsTest = artifacts.require("SettlementUtilsTest") as SettlementUtilsTestArtifact;
const RepublicToken = artifacts.require("RepublicToken") as RepublicTokenArtifact;
const DarknodeRegistry = artifacts.require("DarknodeRegistry") as DarknodeRegistryArtifact;

contract("SettlementUtils", (accounts: string[]) => {

    let settlementTest: SettlementUtilsTestContract;
    let ren: RepublicTokenContract;
    let dnr: DarknodeRegistryContract;
    const darknode = accounts[2];

    before(async () => {
        settlementTest = await SettlementUtilsTest.new();
        ren = await RepublicToken.deployed();
        dnr = await DarknodeRegistry.deployed();

        // Register darknode
        await ren.transfer(darknode, MINIMUM_BOND.toFixed());
        await ren.approve(dnr.address, MINIMUM_BOND.toFixed(), { from: darknode });
        await dnr.register(darknode, PUBK("1"), { from: darknode });
        await waitForEpoch(dnr);
    });

    it("can verify match details", async () => {
        const BUY1 = [web3.utils.sha3("0"), 1, "0x1", 10, 10000, 0];
        const BUY2 = [web3.utils.sha3("0"), 1, "0x1", 11, 10000, 0];
        const SELL = [web3.utils.sha3("0"), 1, "0x100000000", 10, 1000, 0];

        const buyID1 = await settlementTest.hashOrder.apply(this, [...BUY1]);
        const buyID2 = await settlementTest.hashOrder.apply(this, [...BUY2]);
        const sellID = await settlementTest.hashOrder.apply(this, [...SELL]);

        await settlementTest.submitOrder.apply(this, [...BUY1]);
        await settlementTest.submitOrder.apply(this, [...BUY2]);
        await settlementTest.submitOrder.apply(this, [...SELL]);

        (await settlementTest.verifyMatchDetails(buyID1, sellID))
            .should.be.true;
        (await settlementTest.verifyMatchDetails(buyID2, sellID))
            .should.be.true;
    });

    it("fails for invalid tokens", async () => {
        // Tokens are not compatible
        const BUY = [web3.utils.sha3("0"), 2, "0x1", 1, 1, 0];
        const SELL = [web3.utils.sha3("0"), 2, "0x1", 1, 1, 0];

        const buyID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const sellID = await settlementTest.hashOrder.apply(this, [...SELL]);
        await settlementTest.submitOrder.apply(this, [...BUY]);
        await settlementTest.submitOrder.apply(this, [...SELL]);

        (await settlementTest.verifyMatchDetails(buyID, sellID))
            .should.be.false;
    });

    it("fails for invalid price", async () => {
        // Buy price is lower than sell price
        const BUY = [web3.utils.sha3("0"), 2, "0x1", 9, 1, 0];
        const SELL = [web3.utils.sha3("0"), 2, "0x100000000", 10, 1, 0];

        const buyID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const sellID = await settlementTest.hashOrder.apply(this, [...SELL]);
        await settlementTest.submitOrder.apply(this, [...BUY]);
        await settlementTest.submitOrder.apply(this, [...SELL]);

        (await settlementTest.verifyMatchDetails(buyID, sellID))
            .should.be.false;
    });

    it("fails for invalid buy volume", async () => {
        // Tokens are not compatible
        const BUY = [web3.utils.sha3("0"), 2, "0x1", 1, 1, 0];
        const SELL = [web3.utils.sha3("0"), 2, "0x100000000", 1, 2, 2];

        const buyID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const sellID = await settlementTest.hashOrder.apply(this, [...SELL]);
        await settlementTest.submitOrder.apply(this, [...BUY]);
        await settlementTest.submitOrder.apply(this, [...SELL]);

        (await settlementTest.verifyMatchDetails(buyID, sellID))
            .should.be.false;
    });

    it("fails for invalid sell volume", async () => {
        // Tokens are not compatible
        const BUY = [web3.utils.sha3("0"), 2, "0x1", 1, 2, 2];
        const SELL = [web3.utils.sha3("0"), 2, "0x100000000", 1, 1, 0];

        const buyID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const sellID = await settlementTest.hashOrder.apply(this, [...SELL]);
        await settlementTest.submitOrder.apply(this, [...BUY]);
        await settlementTest.submitOrder.apply(this, [...SELL]);

        (await settlementTest.verifyMatchDetails(buyID, sellID))
            .should.be.false;
    });

    it("fails for invalid settlement ID", async () => {
        // Tokens are not compatible
        const BUY = [web3.utils.sha3("0"), 1, "0x1", 1, 1, 0];
        const SELL = [web3.utils.sha3("0"), 2, "0x100000000", 1, 1, 0];

        const buyID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const sellID = await settlementTest.hashOrder.apply(this, [...SELL]);
        await settlementTest.submitOrder.apply(this, [...BUY]);
        await settlementTest.submitOrder.apply(this, [...SELL]);

        (await settlementTest.verifyMatchDetails(buyID, sellID))
            .should.be.false;
    });
});
