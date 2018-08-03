const UtilsTest = artifacts.require("UtilsTest.sol");

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
chai.should();

contract("Utils", function (accounts: string[]) {

    let utilsTest;

    before(async function () {
        utilsTest = await UtilsTest.new();
    });

    it("can convert number to string", async function () {
        hexToAscii(await utilsTest.uintToBytes(0)).toString().should.equal("0");
        hexToAscii(await utilsTest.uintToBytes(32)).toString().should.equal("32");
        hexToAscii(await utilsTest.uintToBytes(57)).toString().should.equal("57");
        hexToAscii(await utilsTest.uintToBytes(10000)).toString().should.equal("10000");

        // -1 underflows to 2**256 - 1
        hexToAscii(await utilsTest.uintToBytes(-1)).toString()
            .should.equal("115792089237316195423570985008687907853269984665640564039457584007913129639935");
    });
});

const hexToAscii = (hex) => {
    return Buffer.from(hex.slice(2), "hex").toString();
};