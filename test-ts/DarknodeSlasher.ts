import BigNumber from "bignumber.js";

import * as testUtils from "./helper/testUtils";
import { MINIMUM_BOND } from "./helper/testUtils";

import { ApprovingBrokerArtifact } from "./bindings/approving_broker";
import { BrokerVerifierContract } from "./bindings/broker_verifier";
import { DarknodeRegistryContract } from "./bindings/darknode_registry";
import { DarknodeSlasherContract } from "./bindings/darknode_slasher";
import { OrderbookContract } from "./bindings/orderbook";
import { RepublicTokenContract } from "./bindings/republic_token";
import { SettlementRegistryContract } from "./bindings/settlement_registry";
import { SettlementUtilsTestArtifact, SettlementUtilsTestContract } from "./bindings/settlement_utils_test";

import { TestHelper } from "zos";

import * as deployRepublicProtocolContracts from "../migrations/deploy";

const fixWeb3 = require("../migrations/fixWeb3");
const defaultConfig = require("../migrations/config");

const ApprovingBroker = artifacts.require("ApprovingBroker") as ApprovingBrokerArtifact;
const SettlementUtilsTest = artifacts.require("SettlementUtilsTest") as SettlementUtilsTestArtifact;

contract("Darknode Slasher", (accounts: string[]) => {
    const proxyOwner = accounts[9];
    const contractOwner = accounts[8];
    // const notOwner = accounts[7];

    let republicToken: RepublicTokenContract;
    let darknodeRegistry: DarknodeRegistryContract;
    let orderbook: OrderbookContract;
    let darknodeSlasher: DarknodeSlasherContract;
    let settlementTest: SettlementUtilsTestContract;
    let settlementRegistry: SettlementRegistryContract;
    const [darknode5, darknode6, darknode7] = [accounts[5], accounts[6], accounts[7]];

    const approvingBrokerID = 0x539;

    before(async () => {
        fixWeb3(web3, artifacts);
        this.app = await TestHelper({ from: proxyOwner, gasPrice: 10000000000 });
        const config = { ...defaultConfig, CONTRACT_OWNER: contractOwner };
        ({ orderbook, darknodeRegistry, republicToken, darknodeSlasher, settlementRegistry } =
            await deployRepublicProtocolContracts(artifacts, this.app, config));

        settlementTest = await SettlementUtilsTest.new({ from: contractOwner });

        const approvingBroker: BrokerVerifierContract = await ApprovingBroker.new({ from: contractOwner });

        await settlementRegistry.registerSettlement(
            approvingBrokerID, testUtils.NULL, approvingBroker.address, { from: contractOwner },
        );

        // Register 3 darknodes
        await republicToken.transfer(accounts[1], MINIMUM_BOND.toFixed(), { from: contractOwner });
        await republicToken.transfer(accounts[2], MINIMUM_BOND.toFixed(), { from: contractOwner });
        await republicToken.transfer(accounts[3], MINIMUM_BOND.toFixed(), { from: contractOwner });

        await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: accounts[1] });
        await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: accounts[2] });
        await republicToken.approve(darknodeRegistry.address, MINIMUM_BOND.toFixed(), { from: accounts[3] });

        await darknodeRegistry.register(darknode5, testUtils.PUBK("1"), { from: accounts[1] });
        await darknodeRegistry.register(darknode6, testUtils.PUBK("2"), { from: accounts[2] });
        await darknodeRegistry.register(darknode7, testUtils.PUBK("3"), { from: accounts[3] });
        await testUtils.waitForEpoch(darknodeRegistry, { from: contractOwner });

        (await darknodeRegistry.isRegistered(darknode5)).should.be.true;
        (await darknodeRegistry.isRegistered(darknode6)).should.be.true;
        (await darknodeRegistry.isRegistered(darknode7)).should.be.true;

        (await darknodeRegistry.isDeregisterable(darknode5)).should.be.true;
        (await darknodeRegistry.isDeregisterable(darknode6)).should.be.true;
        (await darknodeRegistry.isDeregisterable(darknode7)).should.be.true;
    });

    it("anyone other than registered darknodes cannot submit challenge order", async () => {
        const ORDER = [web3.utils.sha3("1"), 1, "0x100000000", 10, 1000, 0];

        await darknodeSlasher.submitChallengeOrder.apply(this, [...ORDER, { from: accounts[1] }])
            .should.be.rejectedWith(null, /must be darknode/);
    });

    it("should fail to submit challenge order twice", async () => {
        const ORDER = [web3.utils.sha3("2"), 1, "0x100000000", 10, 1000, 0];
        await darknodeSlasher.submitChallengeOrder.apply(this, [...ORDER, { from: darknode5 }]);

        await darknodeSlasher.submitChallengeOrder.apply(this, [...ORDER, { from: darknode5 }])
            .should.be.rejectedWith(null, /already submitted/);
    });

    it("bonds can be slashed for wrongful order confirmations", async () => {
        const BUY = [web3.utils.sha3("3"), 2, "0x100000000", 10, 1, 2];
        const SELL = [web3.utils.sha3("4"), 2, "0x1", 10, 1, 2];

        await darknodeSlasher.submitChallengeOrder.apply(this, [...BUY, { from: darknode5 }]);
        await darknodeSlasher.submitChallengeOrder.apply(this, [...SELL, { from: darknode6 }]);

        const buyID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const sellID = await settlementTest.hashOrder.apply(this, [...SELL]);

        await testUtils.openBuyOrder(orderbook, approvingBrokerID, accounts[8], buyID);
        await testUtils.openSellOrder(orderbook, approvingBrokerID, accounts[4], sellID);
        await orderbook.confirmOrder(buyID, sellID, { from: darknode7 });

        // The confirmer's bond will be halved
        const bondBefore = await darknodeRegistry.getDarknodeBond(darknode7);
        await darknodeSlasher.submitChallenge(buyID, sellID, { from: accounts[0] });
        const bondAfter = new BigNumber((await darknodeRegistry.getDarknodeBond(darknode7)));
        bondAfter.times(2).should.bignumber.equal(bondBefore);
    });

    it("challenges can't be submitted multiple times", async () => {
        const BUY = [web3.utils.sha3("5"), 2, "0x100000000", 10, 1, 2];
        const SELL = [web3.utils.sha3("6"), 2, "0x1", 10, 1, 2];

        await darknodeSlasher.submitChallengeOrder.apply(this, [...BUY, { from: darknode5 }]);
        await darknodeSlasher.submitChallengeOrder.apply(this, [...SELL, { from: darknode6 }]);

        const buyID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const sellID = await settlementTest.hashOrder.apply(this, [...SELL]);

        await testUtils.openBuyOrder(orderbook, approvingBrokerID, accounts[8], buyID);
        await testUtils.openSellOrder(orderbook, approvingBrokerID, accounts[4], sellID);
        await orderbook.confirmOrder(buyID, sellID, { from: darknode7 });

        await darknodeSlasher.submitChallenge(buyID, sellID, { from: accounts[0] });

        // Slashing (and with orders swapped) should be rejected
        await darknodeSlasher.submitChallenge(buyID, sellID, { from: accounts[0] })
            .should.be.rejectedWith(/already challenged/);
        await darknodeSlasher.submitChallenge(sellID, buyID, { from: accounts[0] })
            .should.be.rejectedWith(/already challenged/);
    });

    it("matched orders do not get punished", async () => {
        const BUY = [web3.utils.sha3("6"), 1, "0x100000000", 10, 1000, 0];
        const SELL = [web3.utils.sha3("7"), 1, "0x1", 10, 10000, 0];

        await darknodeSlasher.submitChallengeOrder.apply(this, [...BUY, { from: darknode5 }]);
        await darknodeSlasher.submitChallengeOrder.apply(this, [...SELL, { from: darknode6 }]);

        const sellID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const buyID = await settlementTest.hashOrder.apply(this, [...SELL]);
        await testUtils.openBuyOrder(orderbook, approvingBrokerID, accounts[8], buyID);
        await testUtils.openSellOrder(orderbook, approvingBrokerID, accounts[4], sellID);
        await orderbook.confirmOrder(buyID, sellID, { from: darknode7 });

        // Slash should be rejected
        await darknodeSlasher.submitChallenge(buyID, sellID, { from: accounts[0] })
            .should.be.rejectedWith(/invalid challenge/);
    });

    it("non-confirmed orders do not get punished", async () => {
        const BUY = [web3.utils.sha3("7"), 1, "0x100000000", 1, 1, 0];
        const SELL = [web3.utils.sha3("8"), 1, "0x1", 1, 1, 0];

        await darknodeSlasher.submitChallengeOrder.apply(this, [...BUY, { from: darknode5 }]);
        await darknodeSlasher.submitChallengeOrder.apply(this, [...SELL, { from: darknode6 }]);

        const sellID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const buyID = await settlementTest.hashOrder.apply(this, [...SELL]);
        await testUtils.openBuyOrder(orderbook, approvingBrokerID, accounts[8], buyID);
        await testUtils.openSellOrder(orderbook, approvingBrokerID, accounts[4], sellID);

        // Slash should be rejected
        await darknodeSlasher.submitChallenge(buyID, sellID, { from: accounts[0] })
            .should.be.rejectedWith(/unconfirmed orders/);
    });

    it("can't slash if order details haven't been submitted", async () => {
        const BUY = [web3.utils.sha3("8"), 1, "0x100000000", 1, 1, 0];
        const SELL = [web3.utils.sha3("9"), 1, "0x1", 1, 1, 0];

        const buyID = await settlementTest.hashOrder.apply(this, [...BUY]);
        const sellID = await settlementTest.hashOrder.apply(this, [...SELL]);

        // Slash should be rejected if buy details arepublicToken't available
        await darknodeSlasher.submitChallenge(buyID, sellID, { from: accounts[0] })
            .should.be.rejectedWith(/details unavailable/);

        await darknodeSlasher.submitChallengeOrder.apply(this, [...BUY, { from: darknode5 }]);

        // Slash should be rejected if sell details arepublicToken't available
        await darknodeSlasher.submitChallenge(buyID, sellID, { from: accounts[0] })
            .should.be.rejectedWith(/details unavailable/);
    });
});
