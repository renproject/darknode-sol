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

        it("should correctly generate the dist priv key message", async () => {
            const a = new BN("3");
            const b = new BN("7");
            const c = new BN("10");
            const d = new BN("81804755166950992694975918889421430561708705428859269028015361660142001064486");
            const e = new BN("90693014804679621771165998959262552553277008236216558633727798007697162314221");
            const f = new BN("65631258835468800295340604864107498262349560547191423452833833494209803247319");
            const msg = generateDistPrivKeyShareMessage(a, b, c, d, e, f);
            msg.should.be.equal("DistPrivKeyShare(ShamirShare(3,7,S256N(10),S256PrivKey(S256N(81804755166950992694975918889421430561708705428859269028015361660142001064486),S256P(90693014804679621771165998959262552553277008236216558633727798007697162314221),S256P(65631258835468800295340604864107498262349560547191423452833833494209803247319))))");
            const rawMsg = await validateTest.distPrivKeyShareMessage(a, b, c, d, e, f);
            msg.should.be.equal(web3.utils.hexToAscii(rawMsg));
        });


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

export const generateDistPrivKeyShareMessage = (a: BN, b: BN, c: BN, d: BN, e: BN, f: BN): string => {
    return `DistPrivKeyShare(ShamirShare(${a.toString()},${b.toString()},S256N(${c.toString()}),S256PrivKey(S256N(${d.toString()}),S256P(${e.toString()}),S256P(${f.toString()}))))`;
}
