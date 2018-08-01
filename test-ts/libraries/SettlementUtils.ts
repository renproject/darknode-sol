const SettlementUtilsTest = artifacts.require("SettlementUtilsTest");

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
chai.should();

contract("SettlementUtils", function () {

    let settlementTest;
    let expiry;
    let buyID_1, sellID_1;
    let buyID_2, sellID_2;
    let buyID_3, sellID_3;

    before(async function () {
        settlementTest = await SettlementUtilsTest.new();
        expiry = Math.floor(Date.now() / 1000 + (24 * 60 * 60));

        // sellID_1?
        sellID_1 = await settlementTest.hashOrder(1, 1, 0, expiry, 1, 10, 1000, 0, "0x8b22392130c3f688ca01492792a3a0cbecfa202729c249eba6cf0dce0ffa31b0");

        // buyID_1?
        buyID_1 = await settlementTest.hashOrder(1, 0, 0, expiry, 1, 10, 10000, 0, "0x242efbba437ce0c8b22392130c3f688ca01492792a3a04899d66dce0ffa31b72");

        // sellID_2?
        sellID_2 = await settlementTest.hashOrder(1, 1, 0, expiry, 1, 10, 1000, 0, "0x2a3a0cbecfa202729c249eba68b22392130c3f688ca0149279cf0dce0ffa31b0");

        // buyID_2?
        buyID_2 = await settlementTest.hashOrder(1, 0, 0, expiry, 1, 11, 10000, 0, "0x1492792a3a04899d66dc242efbba437ce0c8b22392130c3f688ca0e0ffa31b72");
         
        // sellID_3?
        sellID_3 = await settlementTest.hashOrder(2, 1, 0, expiry, 2, 10, 1000, 0, "0xccd3dd4361d50a9df13af30388e2574b5e9e875c638bdfd15efb47395686ac3d");

        // buyID_3?
        buyID_3 = await settlementTest.hashOrder(2, 0, 0, expiry, 2, 9, 10000, 0, "0xccd3dd4361d50a9df13af30388e2574b5e9e875c638bdfd15efb47395686ac3d");
    });

    it("submitOrder", async () => {
        
        // submitOrder(settlementID, parity, orderType, expiry, tokens, price, volume, minimumVolume, nonceHash)
        await settlementTest.submitOrder(1, 1, 0, expiry, 1, 10, 1000, 0, "0x8b22392130c3f688ca01492792a3a0cbecfa202729c249eba6cf0dce0ffa31b0");

        await settlementTest.submitOrder(1, 0, 0, expiry, 1, 10, 10000, 0, "0x242efbba437ce0c8b22392130c3f688ca01492792a3a04899d66dce0ffa31b72");

        await settlementTest.submitOrder(1, 1, 0, expiry, 1, 10, 1000, 0, "0x2a3a0cbecfa202729c249eba68b22392130c3f688ca0149279cf0dce0ffa31b0");

        await settlementTest.submitOrder(1, 0, 0, expiry, 1, 11, 10000, 0, "0x1492792a3a04899d66dc242efbba437ce0c8b22392130c3f688ca0e0ffa31b72");

        await settlementTest.submitOrder(2, 1, 0, expiry, 2, 10, 1000, 0, "0xccd3dd4361d50a9df13af30388e2574b5e9e875c638bdfd15efb47395686ac3d");

        await settlementTest.submitOrder(2, 0, 0, expiry, 2, 9, 10000, 0, "0xccd3dd4361d50a9df13af30388e2574b5e9e875c638bdfd15efb47395686ac3d");
    });

    it("Verify Match", async () => {
        console.log(buyID_1);
        console.log(buyID_2);
        console.log(buyID_3);
        console.log(sellID_1);
        console.log(sellID_2);
        console.log(sellID_3);

        const a = await settlementTest.orderDetails(buyID_1);
        console.log(a);

        await settlementTest.verifyMatch(buyID_1, sellID_1).should.be.rejected;        
        await settlementTest.verifyMatch(buyID_2, sellID_2).should.be.rejected;
        await settlementTest.verifyMatch(buyID_3, sellID_3).should.be.rejected;
    });
});
