import BN from "bn.js";
import hashjs from 'hash.js';

import { Account } from "web3-eth-accounts";
import { ecsign } from "ethereumjs-util";

import { Ox } from "./helper/testUtils";
import { ValidateTestInstance } from "../types/truffle-contracts";

export interface Darknode {
    account: Account;
    privateKey: Buffer;
}

const ValidateTest = artifacts.require("ValidateTest");

const numDarknodes = 2;

contract("Validate", (accounts: string[]) => {

    let validateTest: ValidateTestInstance;
    let darknodes = new Array<Darknode>();

    before(async () => {
        validateTest = await ValidateTest.new();

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
            const rawMsg = await validateTest.proposeMessage(height, round, hexBlockhash, validRound);
            proposeMsg.should.be.equal(web3.utils.hexToAscii(rawMsg));
        });

        it("should correctly generate the prevote message", async () => {
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash = web3.utils.asciiToHex(blockhash);
            const prevoteMsg = generatePrevoteMessage(height, round, blockhash);
            const rawMsg = await validateTest.prevoteMessage(height, round, hexBlockhash);
            prevoteMsg.should.be.equal(web3.utils.hexToAscii(rawMsg));
        });

        it("should correctly generate the precommit message", async () => {
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash = web3.utils.asciiToHex(blockhash);
            const precommitMsg = generatePrecommitMessage(height, round, blockhash);
            const rawMsg = await validateTest.precommitMessage(height, round, hexBlockhash);
            precommitMsg.should.be.equal(web3.utils.hexToAscii(rawMsg));
        });
    });

    describe("when recovering signatures", async () => {

        it("can recover the signer of a propose message", async () => {
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
            const signer = await validateTest.recoverPropose(height, round, hexBlockhash, validRound, sigString);
            signer.should.equal(darknode.account.address);
        });

        it("can recover the signer of a prevote message", async () => {
            const darknode = darknodes[0];
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash = web3.utils.asciiToHex(blockhash);
            const proposeMsg = generatePrevoteMessage(height, round, blockhash);
            const hash = hashjs.sha256().update(proposeMsg).digest('hex')
            const sig = ecsign(Buffer.from(hash, "hex"), darknode.privateKey);
            const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);
            const signer = await validateTest.recoverPrevote(height, round, hexBlockhash, sigString);
            signer.should.equal(darknode.account.address);
        });

        it("can recover the signer of a precommit message", async () => {
            const darknode = darknodes[0];
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash = web3.utils.asciiToHex(blockhash);
            const proposeMsg = generatePrecommitMessage(height, round, blockhash);
            const hash = hashjs.sha256().update(proposeMsg).digest('hex')
            const sig = ecsign(Buffer.from(hash, "hex"), darknode.privateKey);
            const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);
            const signer = await validateTest.recoverPrecommit(height, round, hexBlockhash, sigString);
            signer.should.equal(darknode.account.address);
        });

    });

});

export const generateProposeMessage = (height: BN, round: BN, blockHash: string, validRound: BN): string => {
    return `Propose(Height=${height.toString()},Round=${round.toString()},BlockHash=${blockHash},ValidRound=${validRound.toString()})`;
}

export const generatePrevoteMessage = (height: BN, round: BN, blockHash: string): string => {
    return `Prevote(Height=${height.toString()},Round=${round.toString()},BlockHash=${blockHash})`;
}

export const generatePrecommitMessage = (height: BN, round: BN, blockHash: string): string => {
    return `Precommit(Height=${height.toString()},Round=${round.toString()},BlockHash=${blockHash})`;
}
