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

    // Doesn't replace verifying the function logic - but the function will
    // likely only be used for values up to 10'000 anyway.
    it.skip("can convert numbers from 0 to 10'000 to string", async function () {
        for (let i = 0; i <= 10000; i++) {
            process.stdout.write(`\rConverting #${i}`);
            hexToAscii(await utilsTest.uintToBytes(i)).toString().should.equal(`${i}`);
        }
        console.log("");
    });

    it("can recover address from signature", async function () {
        const id = "0x6b461b846c349ffe77d33c77d92598cfff854ef2aabe72567cd844be75261b9d";

        // tslint:disable-next-line:max-line-length
        const signature = "0x5f9b4834c252960cec91116f1138262cca723a579dfc1a3405c9900862c63a415885c79d1e8ced229cfc753df6db88309141a7c1a2478d2d77956982288868311b";

        (await utilsTest.addr(id, signature)).should.equal("0xE2bddAF2C7650182D9E3F8Ba19d538937d976309");
    });
});

const hexToAscii = (hex) => {
    return Buffer.from(hex.slice(2), "hex").toString();
};