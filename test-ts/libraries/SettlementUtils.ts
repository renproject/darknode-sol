const SettlementUtilsTest = artifacts.require("SettlementUtilsTest");

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
chai.should();

contract("SettlementUtils", function () {

    let settlementTest;
    let buyID_1, sellID_1;
    let buyID_2, sellID_2;
    let buyID_3, sellID_3;

    before(async function () {
        settlementTest = await SettlementUtilsTest.new();
        // sellID_1?
        sellID_1 = await settlementTest.hashOrder(web3.utils.sha3("0"), 1, "0x100000000", 10, 1000, 0);
        // buyID_1?
        buyID_1 = await settlementTest.hashOrder(web3.utils.sha3("0"), 1, "0x1", 10, 10000, 0);
        // sellID_2?
        sellID_2 = await settlementTest.hashOrder(web3.utils.sha3("0"), 1, "0x100000000", 10, 1000, 0);
        // buyID_2?
        buyID_2 = await settlementTest.hashOrder(web3.utils.sha3("0"), 1, "0x1", 11, 10000, 0);
        // sellID_3?
        sellID_3 = await settlementTest.hashOrder(web3.utils.sha3("0"), 2, "0x100000000", 10, 1000, 0);
        // buyID_3?
        buyID_3 = await settlementTest.hashOrder(web3.utils.sha3("0"), 2, "0x1", 9, 10000, 0);
    });

    it("can verify match details", async () => {
        // submitOrder(settlementID, parity, orderType, expiry, tokens, price, volume, minimumVolume, nonceHash)
        await settlementTest.submitOrder(web3.utils.sha3("0"), 1, "0x100000000", 10, 1000, 0);
        await settlementTest.submitOrder(web3.utils.sha3("0"), 1, "0x1", 10, 10000, 0);
        await settlementTest.submitOrder(web3.utils.sha3("0"), 2, "0x100000000", 10, 1000, 0);
        await settlementTest.submitOrder(web3.utils.sha3("0"), 2, "0x1", 9, 10000, 0);
        await settlementTest.submitOrder(web3.utils.sha3("0"), 1, "0x100000000", 10, 1000, 0);
        await settlementTest.submitOrder(web3.utils.sha3("0"), 1, "0x1", 11, 10000, 0);

        (await settlementTest.verifyMatchDetails(buyID_1, sellID_1))
            .should.be.true;
        (await settlementTest.verifyMatchDetails(buyID_2, sellID_2))
            .should.be.true;
        (await settlementTest.verifyMatchDetails(buyID_3, sellID_3))
            .should.be.false;
    });
});
