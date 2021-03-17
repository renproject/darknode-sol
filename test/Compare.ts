import { expect } from "chai";

import { CompareTestInstance } from "../types/truffle-contracts";

const CompareTest = artifacts.require("CompareTest");

contract("Compare", accounts => {
    let CompareInstance: CompareTestInstance;

    before(async () => {
        CompareInstance = await CompareTest.new();
    });

    describe("when bytes are the same length", async () => {
        it("should return false when content is different", async () => {
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const blockhash2 = "sdkjfhaefhefjhskjefjhefhjksefkehjfsjc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            expect(
                await CompareInstance.bytesEqual.call(
                    hexBlockhash1,
                    hexBlockhash2
                )
            ).to.be.false;
        });

        it("should return true when content is the same", async () => {
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            expect(
                await CompareInstance.bytesEqual.call(
                    hexBlockhash1,
                    hexBlockhash1
                )
            ).to.be.true;
            const hexBlockhash2 = web3.utils.asciiToHex("abcdefghijk");
            expect(
                await CompareInstance.bytesEqual.call(
                    hexBlockhash2,
                    hexBlockhash2
                )
            ).to.be.true;
            const hexBlockhash3 = web3.utils.asciiToHex(
                "hukrasefaakuflehlafsefhuha2h293f8"
            );
            expect(
                await CompareInstance.bytesEqual.call(
                    hexBlockhash3,
                    hexBlockhash3
                )
            ).to.be.true;
        });
    });

    describe("when bytes are of different length", async () => {
        it("should return false", async () => {
            const blockhash1 = "XTsJ2rO2yD47tg3J";
            const blockhash2 = "sdkjfhaefhefjhskjefjhefhjksefkehjfsjc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            expect(
                await CompareInstance.bytesEqual.call(
                    hexBlockhash1,
                    hexBlockhash2
                )
            ).to.be.false;
        });
    });
});
