const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const Orderbook = artifacts.require("Orderbook");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const RepublicToken = artifacts.require("RepublicToken");
const SettlementUtilsTest = artifacts.require("SettlementUtilsTest");

import * as testUtils from "./helper/testUtils";
import { INGRESS_FEE, MINIMUM_BOND } from "./helper/testUtils";

contract("Darknode Slasher", function (accounts: string[]) {

    let expiry, dnr, ren, orderbook, slasher, settlementTest;
    const [darknode5, darknode6, darknode7] = [accounts[5], accounts[6], accounts[7]];
    const broker = accounts[0];

    before(async function () {
        expiry = Math.floor(Date.now() / 1000 + (24 * 60 * 60));

        settlementTest = await SettlementUtilsTest.new();

        ren = await RepublicToken.deployed();
        dnr = await DarknodeRegistry.deployed();
        orderbook = await Orderbook.deployed();
        slasher = await DarknodeSlasher.deployed();

        // Broker
        await ren.transfer(broker, INGRESS_FEE * 10);
        await ren.approve(orderbook.address, INGRESS_FEE * 10);

        // Register 3 darknodes
        await ren.transfer(accounts[1], MINIMUM_BOND);
        await ren.transfer(accounts[2], MINIMUM_BOND);
        await ren.transfer(accounts[3], MINIMUM_BOND);

        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[1] });
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[2] });
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[3] });

        await dnr.register(darknode5, testUtils.PUBK("1"), MINIMUM_BOND, { from: accounts[1] });
        await dnr.register(darknode6, testUtils.PUBK("2"), MINIMUM_BOND, { from: accounts[2] });
        await dnr.register(darknode7, testUtils.PUBK("3"), MINIMUM_BOND, { from: accounts[3] });
        await testUtils.waitForEpoch(dnr);

        (await dnr.isRegistered(darknode5)).should.be.true;
        (await dnr.isRegistered(darknode6)).should.be.true;
        (await dnr.isRegistered(darknode7)).should.be.true;

        (await dnr.isDeregisterable(darknode7)).should.be.true;
    });

    it("darknode can submit challenge order", async () => {
        await slasher.submitChallengeOrder(
            2, 1, 0, expiry, 2, 10, 1000, 0, "0xccd3dd4361d50a9df13af30388e2574b5e9e875c638bdfd15efb47395686ac3d",
            { from: darknode5 }
        );
        await slasher.submitChallengeOrder(
            2, 0, 0, expiry, 2, 9, 10000, 0, "0xdf13af30388e2574b5e9e87ccd3dd4361d50a95c638bdfd15efb47395686ac3d",
            { from: darknode6 }
        );
        await slasher.submitChallengeOrder(
            1, 1, 0, expiry, 1, 10, 1000, 0, "0x8b22392130c3f688ca01492792a3a0cbecfa202729c249eba6cf0dce0ffa31b0",
            { from: darknode5 }
        );
        await slasher.submitChallengeOrder(
            1, 0, 0, expiry, 1, 10, 10000, 0, "0x242efbba437ce0c8b22392130c3f688ca01492792a3a04899d66dce0ffa31b72",
            { from: darknode6 }
        );
    });

    it("anyone other than registered darknodes cannot submit challenge order", async () => {
        await slasher.submitChallengeOrder(
            2, 1, 0, expiry, 2, 10, 1000, 0, "0xccd3dd4361d50a9df13af30388e2574b5e9e875c638bdfd15efb47395686ac3d",
            { from: accounts[1] }
        ).should.be.rejectedWith(null, /must be darknode/);
        await slasher.submitChallengeOrder(
            2, 0, 0, expiry, 2, 9, 10000, 0, "0xdf13af30388e2574b5e9e87ccd3dd4361d50a95c638bdfd15efb47395686ac3d",
            { from: accounts[2] }
        ).should.be.rejectedWith(null, /must be darknode/);
    });

    it("should fail to submit challenge order twice", async () => {
        await slasher.submitChallengeOrder(
            1, 1, 0, expiry, 1, 10, 1000, 0, "0x8b22392130c3f688ca01492792a3a0cbecfa202729c249eba6cf0dce0ffa31b0",
            { from: darknode5 }
        ).should.be.rejectedWith(null, /already challenged/);
        await slasher.submitChallengeOrder(
            1, 0, 0, expiry, 1, 10, 10000, 0, "0x242efbba437ce0c8b22392130c3f688ca01492792a3a04899d66dce0ffa31b72",
            { from: darknode6 }
        ).should.be.rejectedWith(null, /already challenged/);
    });

    it("mismatched orders get punished", async () => {
        let sellID = await settlementTest.hashOrder(
            2, 1, 0, expiry, 2, 10, 1000, 0, "0xccd3dd4361d50a9df13af30388e2574b5e9e875c638bdfd15efb47395686ac3d"
        );
        let buyID = await settlementTest.hashOrder(
            2, 0, 0, expiry, 2, 9, 10000, 0, "0xdf13af30388e2574b5e9e87ccd3dd4361d50a95c638bdfd15efb47395686ac3d"
        );
        await testUtils.openBuyOrder(orderbook, broker, accounts[8], buyID);
        await testUtils.openSellOrder(orderbook, broker, accounts[9], sellID);
        await orderbook.confirmOrder(buyID, [sellID], { from: darknode7 });
        await slasher.submitChallenge(buyID, sellID);
    });

    it("matched orders do not get punished", async () => {
        let sellID = await settlementTest.hashOrder(
            1, 1, 0, expiry, 1, 10, 1000, 0, "0x8b22392130c3f688ca01492792a3a0cbecfa202729c249eba6cf0dce0ffa31b0"
        );
        let buyID = await settlementTest.hashOrder(
            1, 0, 0, expiry, 1, 10, 10000, 0, "0x242efbba437ce0c8b22392130c3f688ca01492792a3a04899d66dce0ffa31b72"
        );
        await testUtils.openBuyOrder(orderbook, broker, accounts[8], buyID);
        await testUtils.openSellOrder(orderbook, broker, accounts[9], sellID);
        await orderbook.confirmOrder(buyID, [sellID], { from: darknode7 });
        await slasher.submitChallenge(buyID, sellID).should.be.rejectedWith(/invalid challenge/);
    });
});
