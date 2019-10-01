import { StringTestInstance } from "../types/truffle-contracts";
import { randomBytes } from "./helper/testUtils";
import BN = require("bn.js");

const StringTest = artifacts.require("StringTest");

contract("String", (accounts) => {

    let StringInstance: StringTestInstance;

    before(async () => {
        StringInstance = await StringTest.new();
    });

    // Skipped for now due to an issue with the coverage tool.
    // The tests pass when run without coverage.
    it("can add strings", async () => {
        (await StringInstance.add4("1", "2", "3", "4"))
            .should.equal("1234");
    });

    it("can convert addresses to hex strings", async () => {
        (await StringInstance.fromAddress(accounts[0]))
            .should.equal(accounts[0].toLowerCase());
    });

    it("can convert bytes32 to hex strings", async () => {
        const bytes32 = randomBytes(32);

        (await StringInstance.fromBytes32(bytes32))
            .should.equal(bytes32.toLowerCase());
    });

    it("can convert uint to strings", async () => {
        (await StringInstance.fromUint(new BN(0))).should.equal("0");
        (await StringInstance.fromUint(new BN(1))).should.equal("1");
        (await StringInstance.fromUint(new BN(12345))).should.equal("12345");
    });
});
