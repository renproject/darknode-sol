import { StringTestInstance } from "../types/truffle-contracts";
import { randomBytes } from "./helper/testUtils";

const StringTest = artifacts.require("StringTest");

contract("String", (accounts) => {

    let String: StringTestInstance;

    before(async () => {
        String = await StringTest.new();
    });

    // Skipped for now due to an issue with the coverage tool.
    // The tests pass when run without coverage.
    it.skip("can add strings", async () => {
        (await String.add4("1", "2", "3", "4"))
            .should.equal("1234");
    });

    it.skip("can convert addresses to hex strings", async () => {
        (await String.fromAddress(accounts[0]))
            .should.equal(accounts[0].toLowerCase());
    });

    it.skip("can convert bytes32 to hex strings", async () => {
        const bytes32 = randomBytes(32);

        (await String.fromBytes32(bytes32))
            .should.equal(bytes32.toLowerCase());
    });
});
