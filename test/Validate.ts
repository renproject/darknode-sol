import BN from "bn.js";
import { ecsign } from "ethereumjs-util";
import hashjs from "hash.js";
import { Account } from "web3-eth-accounts";

import { ValidateTestInstance } from "../types/truffle-contracts";
import { Ox } from "./helper/testUtils";

export interface Darknode {
    account: Account;
    privateKey: Buffer;
}

const ValidateTest = artifacts.require("ValidateTest");

const numDarknodes = 2;

contract("Validate", (accounts: string[]) => {
    let validateTest: ValidateTestInstance;
    const darknodes = new Array<Darknode>();

    before(async () => {
        validateTest = await ValidateTest.new();

        for (let i = 0; i < numDarknodes; i++) {
            const darknode = web3.eth.accounts.create();
            const privKey = Buffer.from(darknode.privateKey.slice(2), "hex");
            darknodes.push({
                account: darknode,
                privateKey: privKey
            });
        }
    });

    describe("when generating messages", async () => {
        it("should correctly generate secret messages", async () => {
            const a = new BN("3");
            const b = new BN("7");
            const c = new BN("10");
            const d = new BN(
                "81804755166950992694975918889421430561708705428859269028015361660142001064486"
            );
            const e = new BN(
                "90693014804679621771165998959262552553277008236216558633727798007697162314221"
            );
            const f = new BN(
                "65631258835468800295340604864107498262349560547191423452833833494209803247319"
            );
            const msg = generateSecretMessage(a, b, c, d, e, f);
            // tslint:disable-next-line:max-line-length
            msg.should.be.equal(
                "Secret(ShamirShare(3,7,S256N(10),S256PrivKey(S256N(81804755166950992694975918889421430561708705428859269028015361660142001064486),S256P(90693014804679621771165998959262552553277008236216558633727798007697162314221),S256P(65631258835468800295340604864107498262349560547191423452833833494209803247319))))"
            );
            const rawMsg = await validateTest.secretMessage.call(
                a,
                b,
                c,
                d,
                e,
                f
            );
            msg.should.be.equal(web3.utils.hexToAscii(rawMsg));
        });

        it("should correctly generate the propose message", async () => {
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash = web3.utils.asciiToHex(blockhash);
            const validRound = new BN("6345888412984379713");
            const proposeMsg = generateProposeMessage(
                height,
                round,
                blockhash,
                validRound
            );
            const rawMsg = await validateTest.proposeMessage.call(
                height,
                round,
                hexBlockhash,
                validRound
            );
            proposeMsg.should.be.equal(web3.utils.hexToAscii(rawMsg));
        });

        it("should correctly generate the prevote message", async () => {
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash = web3.utils.asciiToHex(blockhash);
            const prevoteMsg = generatePrevoteMessage(height, round, blockhash);
            const rawMsg = await validateTest.prevoteMessage.call(
                height,
                round,
                hexBlockhash
            );
            prevoteMsg.should.be.equal(web3.utils.hexToAscii(rawMsg));
        });

        it("should correctly generate the precommit message", async () => {
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash = web3.utils.asciiToHex(blockhash);
            const precommitMsg = generatePrecommitMessage(
                height,
                round,
                blockhash
            );
            const rawMsg = await validateTest.precommitMessage.call(
                height,
                round,
                hexBlockhash
            );
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
            const proposeMsg = generateProposeMessage(
                height,
                round,
                blockhash,
                validRound
            );
            const hash = hashjs
                .sha256()
                .update(proposeMsg)
                .digest("hex");
            const sig = ecsign(Buffer.from(hash, "hex"), darknode.privateKey);
            const sigString = Ox(
                `${sig.r.toString("hex")}${sig.s.toString(
                    "hex"
                )}${sig.v.toString(16)}`
            );
            const signer = await validateTest.recoverPropose.call(
                height,
                round,
                hexBlockhash,
                validRound,
                sigString
            );
            signer.should.equal(darknode.account.address);
        });

        it("can recover the signer of a prevote message", async () => {
            const darknode = darknodes[0];
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash = web3.utils.asciiToHex(blockhash);
            const proposeMsg = generatePrevoteMessage(height, round, blockhash);
            const hash = hashjs
                .sha256()
                .update(proposeMsg)
                .digest("hex");
            const sig = ecsign(Buffer.from(hash, "hex"), darknode.privateKey);
            const sigString = Ox(
                `${sig.r.toString("hex")}${sig.s.toString(
                    "hex"
                )}${sig.v.toString(16)}`
            );
            const signer = await validateTest.recoverPrevote.call(
                height,
                round,
                hexBlockhash,
                sigString
            );
            signer.should.equal(darknode.account.address);
        });

        it("can recover the signer of a precommit message", async () => {
            const darknode = darknodes[0];
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash = web3.utils.asciiToHex(blockhash);
            const proposeMsg = generatePrecommitMessage(
                height,
                round,
                blockhash
            );
            const hash = hashjs
                .sha256()
                .update(proposeMsg)
                .digest("hex");
            const sig = ecsign(Buffer.from(hash, "hex"), darknode.privateKey);
            const sigString = Ox(
                `${sig.r.toString("hex")}${sig.s.toString(
                    "hex"
                )}${sig.v.toString(16)}`
            );
            const signer = await validateTest.recoverPrecommit.call(
                height,
                round,
                hexBlockhash,
                sigString
            );
            signer.should.equal(darknode.account.address);
        });

        it("can recover the signer of a secret message", async () => {
            const darknode = darknodes[0];
            const a = new BN("3");
            const b = new BN("7");
            const c = new BN("10");
            const d = new BN(
                "81804755166950992694975918889421430561708705428859269028015361660142001064486"
            );
            const e = new BN(
                "90693014804679621771165998959262552553277008236216558633727798007697162314221"
            );
            const f = new BN(
                "65631258835468800295340604864107498262349560547191423452833833494209803247319"
            );
            const msg = generateSecretMessage(a, b, c, d, e, f);
            const hash = hashjs
                .sha256()
                .update(msg)
                .digest("hex");
            const sig = ecsign(Buffer.from(hash, "hex"), darknode.privateKey);
            const sigString = Ox(
                `${sig.r.toString("hex")}${sig.s.toString(
                    "hex"
                )}${sig.v.toString(16)}`
            );
            const signer = await validateTest.recoverSecret.call(
                a,
                b,
                c,
                d,
                e,
                f,
                sigString
            );
            signer.should.equal(darknode.account.address);
        });
    });
});

export const generateProposeMessage = (
    height: BN,
    round: BN,
    blockHash: string,
    validRound: BN
): string => {
    // tslint:disable-next-line:max-line-length
    return `Propose(Height=${height.toString()},Round=${round.toString()},BlockHash=${blockHash},ValidRound=${validRound.toString()})`;
};

export const generatePrevoteMessage = (
    height: BN,
    round: BN,
    blockHash: string
): string => {
    return `Prevote(Height=${height.toString()},Round=${round.toString()},BlockHash=${blockHash})`;
};

export const generatePrecommitMessage = (
    height: BN,
    round: BN,
    blockHash: string
): string => {
    return `Precommit(Height=${height.toString()},Round=${round.toString()},BlockHash=${blockHash})`;
};

export const generateSecretMessage = (
    a: BN,
    b: BN,
    c: BN,
    d: BN,
    e: BN,
    f: BN
): string => {
    // tslint:disable-next-line:max-line-length
    return `Secret(ShamirShare(${a.toString()},${b.toString()},S256N(${c.toString()}),S256PrivKey(S256N(${d.toString()}),S256P(${e.toString()}),S256P(${f.toString()}))))`;
};
