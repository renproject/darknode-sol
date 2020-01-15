import BN = require("bn.js");

import { StringTestInstance } from "../types/truffle-contracts";
import { randomBytes } from "./helper/testUtils";

const StringTest = artifacts.require("StringTest");

contract("String", (accounts) => {

    let StringInstance: StringTestInstance;

    before(async () => {
        StringInstance = await StringTest.new();
    });

    it("can add strings", async () => {
        (await StringInstance.add4.call("1", "2", "3", "4"))
            .should.equal("1234");
    });

    it("can convert addresses to hex strings", async () => {
        (await StringInstance.fromAddress.call(accounts[0]))
            .should.equal(accounts[0].toLowerCase());
    });

    it("can convert bytes32 to hex strings", async () => {
        const bytes32 = randomBytes(32);

        (await StringInstance.fromBytes32.call(bytes32))
            .should.equal(bytes32.toLowerCase());
    });

    it("can convert uint to strings", async () => {
        await testNumString("0");
        await testNumString("1");
        await testNumString("12345");
        await testNumString("81804755166950992694975918889421430561708705428859269028015361660142001064486");
        await testNumString("90693014804679621771165998959262552553277008236216558633727798007697162314221");
        await testNumString("65631258835468800295340604864107498262349560547191423452833833494209803247319");
    });

    const testNumString = async (numString: string) => {
        (await StringInstance.fromUint.call(new BN(numString))).should.equal(numString);
    };
});
