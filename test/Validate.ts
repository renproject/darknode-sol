import BN from "bn.js";

import hashjs from 'hash.js';
import { ecsign } from "ethereumjs-util";
import { Ox } from "./helper/testUtils";

import { ValidateTestInstance } from "../types/truffle-contracts";
import { Darknode, generateProposeMessage } from "./DarknodeSlasher";

const ValidateTest = artifacts.require("ValidateTest");

const numDarknodes = 2;

contract("Validate", (accounts: string[]) => {

    let validateList: ValidateTestInstance;
    let darknodes = new Array<Darknode>();

    before(async () => {
        validateList = await ValidateTest.new();

        for (let i = 0; i < numDarknodes; i++) {
            const darknode = web3.eth.accounts.create();
            const privKey = Buffer.from(darknode.privateKey.slice(2), "hex");
            darknodes.push({
                account: darknode,
                privateKey: privKey,
            });
        }
    });

    describe("when generating messages", async () => {

        it("should correctly generate the propose message", async () => {
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash = web3.utils.asciiToHex(blockhash);
            const validRound = new BN("6345888412984379713");
            const proposeMsg = generateProposeMessage(height, round, blockhash, validRound);
            const rawMsg = await validateList.proposeMessage(height, round, hexBlockhash, validRound);
            proposeMsg.should.be.equal(web3.utils.hexToAscii(rawMsg));
        });
    });

    describe("when handling propose messages", async () => {

        it("should recover the signer of a message", async () => {
            const darknode = darknodes[0];
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash = web3.utils.asciiToHex(blockhash);
            const validRound = new BN("6345888412984379713");
            const proposeMsg = generateProposeMessage(height, round, blockhash, validRound);
            const hash = hashjs.sha256().update(proposeMsg).digest('hex')
            const sig = ecsign(Buffer.from(hash, "hex"), darknode.privateKey);
            const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);
            const signer = await validateList.recoverPropose(height, round, hexBlockhash, validRound, sigString);
            signer.should.equal(darknode.account.address);
        });

    });

});
