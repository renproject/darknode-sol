import BigNumber from "bignumber.js";

import * as testUtils from "../helper/testUtils";

import { UtilsTestArtifact, UtilsTestContract } from "../bindings/utils_test";

const UtilsTest = artifacts.require("UtilsTest") as UtilsTestArtifact;

contract("Utils", (accounts: string[]) => {

    let utilsTest: UtilsTestContract;

    before(async () => {
        utilsTest = await UtilsTest.new();
    });

    it("can convert number to string", async () => {
        hexToAscii(await utilsTest.uintToBytes(0)).should.equal("0");
        hexToAscii(await utilsTest.uintToBytes(32)).should.equal("32");
        hexToAscii(await utilsTest.uintToBytes(57)).should.equal("57");
        hexToAscii(await utilsTest.uintToBytes(10000)).should.equal("10000");

        // -1 underflows to 2**256 - 1
        hexToAscii(await utilsTest.uintToBytes(-1))
            .should.bignumber.equal(new BigNumber(2).exponentiatedBy(256).minus(1));
    });

    // Doesn't replace verifying the function logic - but the function will
    // likely only be used for values up to 10'000 anyway.
    it.skip("[LONG] can convert numbers from 0 to 10'000 to string", async () => {
        for (let i = 0; i <= 10000; i++) {
            process.stdout.write(`\rConverting #${i}`);
            hexToAscii(await utilsTest.uintToBytes(i)).should.equal(`${i}`);
        }
        console.log("");
    });

    it("can recover address from signature", async () => {
        const account = accounts[9];
        const id = testUtils.randomID();
        const signature = await testUtils.web3Sign(web3, id, account);
        // Recover address
        (await utilsTest.addr(id, signature)).should.equal(account);
    });
});

const hexToAscii = (hex: string) => {
    return Buffer.from(hex.slice(2), "hex").toString();
};
