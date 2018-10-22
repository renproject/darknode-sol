import BigNumber from "bignumber.js";

import * as testUtils from "./helper/testUtils";
import { MINIMUM_BOND } from "./helper/testUtils";

import { ApprovingBrokerArtifact } from "./bindings/approving_broker";
import { BrokerVerifierContract } from "./bindings/broker_verifier";
import { DarknodeRegistryArtifact, DarknodeRegistryContract } from "./bindings/darknode_registry";
import { DarknodeSlasherArtifact, DarknodeSlasherContract } from "./bindings/darknode_slasher";
import { OrderbookArtifact, OrderbookContract } from "./bindings/orderbook";
import { RepublicTokenArtifact, RepublicTokenContract } from "./bindings/republic_token";
import { SettlementRegistryArtifact, SettlementRegistryContract } from "./bindings/settlement_registry";
import { SettlementUtilsTestArtifact, SettlementUtilsTestContract } from "./bindings/settlement_utils_test";

const SettlementUtilsTest = artifacts.require("SettlementUtilsTest") as SettlementUtilsTestArtifact;
const RepublicToken = artifacts.require("RepublicToken") as RepublicTokenArtifact;
const DarknodeRegistry = artifacts.require("DarknodeRegistry") as DarknodeRegistryArtifact;
const Orderbook = artifacts.require("Orderbook") as OrderbookArtifact;
const DarknodeSlasher = artifacts.require("DarknodeSlasher") as DarknodeSlasherArtifact;
const SettlementRegistry = artifacts.require("SettlementRegistry") as SettlementRegistryArtifact;
const ApprovingBroker = artifacts.require("ApprovingBroker") as ApprovingBrokerArtifact;

contract("Darknode Slasher", (accounts: string[]) => {

    let dnr: DarknodeRegistryContract;
    let ren: RepublicTokenContract;
    let orderbook: OrderbookContract;
    let slasher: DarknodeSlasherContract;
    let settlementTest: SettlementUtilsTestContract;
    const [darknode5, darknode6, darknode7] = [accounts[5], accounts[6], accounts[7]];

    const approvingBrokerID = 0x539;

    before(async () => {
        settlementTest = await SettlementUtilsTest.new();

        ren = await RepublicToken.deployed();
        dnr = await DarknodeRegistry.deployed();
        orderbook = await Orderbook.deployed();
        slasher = await DarknodeSlasher.deployed();

        const settlementRegistry: SettlementRegistryContract = await SettlementRegistry.deployed();

        const approvingBroker: BrokerVerifierContract = await ApprovingBroker.new();

        await settlementRegistry.registerSettlement(approvingBrokerID, testUtils.NULL, approvingBroker.address);

        // Register 3 darknodes
        await ren.transfer(accounts[1], MINIMUM_BOND.toFixed());
        await ren.transfer(accounts[2], MINIMUM_BOND.toFixed());
        await ren.transfer(accounts[3], MINIMUM_BOND.toFixed());

        await ren.approve(dnr.address, MINIMUM_BOND.toFixed(), { from: accounts[1] });
        await ren.approve(dnr.address, MINIMUM_BOND.toFixed(), { from: accounts[2] });
        await ren.approve(dnr.address, MINIMUM_BOND.toFixed(), { from: accounts[3] });

        await dnr.register(darknode5, testUtils.PUBK("1"), { from: accounts[1] });
        await dnr.register(darknode6, testUtils.PUBK("2"), { from: accounts[2] });
        await dnr.register(darknode7, testUtils.PUBK("3"), { from: accounts[3] });
        await testUtils.waitForEpoch(dnr);

        (await dnr.isRegistered(darknode5)).should.be.true;
        (await dnr.isRegistered(darknode6)).should.be.true;
        (await dnr.isRegistered(darknode7)).should.be.true;

        (await dnr.isDeregisterable(darknode5)).should.be.true;
        (await dnr.isDeregisterable(darknode6)).should.be.true;
        (await dnr.isDeregisterable(darknode7)).should.be.true;
    });

    it("anyone other than registered darknodes cannot submit challenge order", async () => {
        const ORDER = [web3.utils.sha3("1"), 1, "0x100000000", 10, 1000, 0];

        await slasher.submitChallengeOrder.apply(this, [...ORDER, { from: accounts[1] }])
            .should.be.rejectedWith(null, /must be darknode/);
    });

    it("should fail to submit challenge order twice", async () => {
        const ORDER = [web3.utils.sha3("2"), 1, "0x100000000", 10, 1000, 0];
        await slasher.submitChallengeOrder.apply(this, [...ORDER, { from: darknode5 }]);

        await slasher.submitChallengeOrder.apply(this, [...ORDER, { from: darknode5 }])
            .should.be.rejectedWith(null, /already submitted/);
    });

    it("bonds can be slashed for wrongful order confirmations", async () => {
        const BUY = [web3.utils.sha3("3"), 2, "0x100000000", 10, 1, 2];
        const SELL = [web3.utils.sha3("4"), 2, "0x1", 10, 1, 2];

        await slasher.submitChallengeOrder.apply(this, [...BUY, { from: darknode5 }]);
        await slasher.submitChallengeOrder.apply(this, [...SELL, { from: darknode6 }]);

        const buyID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const sellID = await settlementTest.hashOrder.apply(this, [...SELL]);

        await testUtils.openOrder(orderbook, approvingBrokerID, accounts[8], buyID);
        await testUtils.openOrder(orderbook, approvingBrokerID, accounts[9], sellID);
        await orderbook.confirmOrder(buyID, sellID, { from: darknode7 });

        // The confirmer's bond will be halved
        const bondBefore = await dnr.getDarknodeBond(darknode7);
        await slasher.submitChallenge(buyID, sellID);
        const bondAfter = new BigNumber((await dnr.getDarknodeBond(darknode7)));
        bondAfter.times(2).should.bignumber.equal(bondBefore);
    });

    it("challenges can't be submitted multiple times", async () => {
        const BUY = [web3.utils.sha3("5"), 2, "0x100000000", 10, 1, 2];
        const SELL = [web3.utils.sha3("6"), 2, "0x1", 10, 1, 2];

        await slasher.submitChallengeOrder.apply(this, [...BUY, { from: darknode5 }]);
        await slasher.submitChallengeOrder.apply(this, [...SELL, { from: darknode6 }]);

        const buyID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const sellID = await settlementTest.hashOrder.apply(this, [...SELL]);

        await testUtils.openOrder(orderbook, approvingBrokerID, accounts[8], buyID);
        await testUtils.openOrder(orderbook, approvingBrokerID, accounts[9], sellID);
        await orderbook.confirmOrder(buyID, sellID, { from: darknode7 });

        await slasher.submitChallenge(buyID, sellID);

        // Slashing (and with orders swapped) should be rejected
        await slasher.submitChallenge(buyID, sellID)
            .should.be.rejectedWith(/already challenged/);
        await slasher.submitChallenge(sellID, buyID)
            .should.be.rejectedWith(/already challenged/);
    });

    it("matched orders do not get punished", async () => {
        const BUY = [web3.utils.sha3("6"), 1, "0x100000000", 10, 1000, 0];
        const SELL = [web3.utils.sha3("7"), 1, "0x1", 10, 10000, 0];

        await slasher.submitChallengeOrder.apply(this, [...BUY, { from: darknode5 }]);
        await slasher.submitChallengeOrder.apply(this, [...SELL, { from: darknode6 }]);

        const sellID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const buyID = await settlementTest.hashOrder.apply(this, [...SELL]);
        await testUtils.openOrder(orderbook, approvingBrokerID, accounts[8], buyID);
        await testUtils.openOrder(orderbook, approvingBrokerID, accounts[9], sellID);
        await orderbook.confirmOrder(buyID, sellID, { from: darknode7 });

        // Slash should be rejected
        await slasher.submitChallenge(buyID, sellID)
            .should.be.rejectedWith(/invalid challenge/);
    });

    it("non-confirmed orders do not get punished", async () => {
        const BUY = [web3.utils.sha3("7"), 1, "0x100000000", 1, 1, 0];
        const SELL = [web3.utils.sha3("8"), 1, "0x1", 1, 1, 0];

        await slasher.submitChallengeOrder.apply(this, [...BUY, { from: darknode5 }]);
        await slasher.submitChallengeOrder.apply(this, [...SELL, { from: darknode6 }]);

        const sellID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const buyID = await settlementTest.hashOrder.apply(this, [...SELL]);
        await testUtils.openOrder(orderbook, approvingBrokerID, accounts[8], buyID);
        await testUtils.openOrder(orderbook, approvingBrokerID, accounts[9], sellID);

        // Slash should be rejected
        await slasher.submitChallenge(buyID, sellID)
            .should.be.rejectedWith(/unconfirmed orders/);
    });

    it("can't slash if order details haven't been submitted", async () => {
        const BUY = [web3.utils.sha3("8"), 1, "0x100000000", 1, 1, 0];
        const SELL = [web3.utils.sha3("9"), 1, "0x1", 1, 1, 0];

        const buyID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const sellID = await settlementTest.hashOrder.apply(this, [...SELL]);

        // Slash should be rejected if buy details aren't available
        await slasher.submitChallenge(buyID, sellID)
            .should.be.rejectedWith(/details unavailable/);

        await slasher.submitChallengeOrder.apply(this, [...BUY, { from: darknode5 }]);

        // Slash should be rejected if sell details aren't available
        await slasher.submitChallenge(buyID, sellID)
            .should.be.rejectedWith(/details unavailable/);
    });
});
