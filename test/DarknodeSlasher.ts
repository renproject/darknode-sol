import BN from "bn.js";

import hashjs from 'hash.js';
// import { config } from "../migrations/networks";
import {
    DarknodeRegistryInstance, DarknodeRegistryStoreInstance, DarknodeSlasherInstance,
    RenTokenInstance,
    DarknodePaymentStoreInstance,
} from "../types/truffle-contracts";
import { ecsign } from "ethereumjs-util";
import { Ox } from "./helper/testUtils";
import {
    ID, MINIMUM_BOND, MINIMUM_EPOCH_INTERVAL_SECONDS, MINIMUM_POD_SIZE, NULL, PUBK, waitForEpoch,
} from "./helper/testUtils";
import { Darknode, generateProposeMessage, generatePrevoteMessage, generatePrecommitMessage } from "./Validate";

const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const RenToken = artifacts.require("RenToken");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");

const numDarknodes = 5;

contract("DarknodeSlasher", (accounts: string[]) => {

    let store: DarknodePaymentStoreInstance;
    let ren: RenTokenInstance;
    let dnrs: DarknodeRegistryStoreInstance;
    let dnr: DarknodeRegistryInstance;
    let slasher: DarknodeSlasherInstance;
    let darknodes = new Array<Darknode>();

    const owner = accounts[0];

    before(async () => {
        ren = await RenToken.deployed();
        dnrs = await DarknodeRegistryStore.deployed();
        dnr = await DarknodeRegistry.deployed();
        store = await DarknodePaymentStore.deployed();
        slasher = await DarknodeSlasher.deployed();
        await dnr.updateSlasher(slasher.address);
        await waitForEpoch(dnr);

        for (let i = 0; i < numDarknodes; i++) {
            const darknode = web3.eth.accounts.create();
            const privKey = Buffer.from(darknode.privateKey.slice(2), "hex");

            // top up the darknode address with 1 ETH
            await web3.eth.sendTransaction({ to: darknode.address, from: owner, value: web3.utils.toWei("1") });
            await web3.eth.personal.importRawKey(darknode.privateKey, "");
            await web3.eth.personal.unlockAccount(darknode.address, "", 6000);

            // transfer ren and register darknode
            await ren.transfer(darknode.address, MINIMUM_BOND);
            await ren.approve(dnr.address, MINIMUM_BOND, { from: darknode.address });
            // Register the darknodes under the account address
            await dnr.register(darknode.address, PUBK(darknode.address), { from: darknode.address });
            darknodes.push({
                account: darknode,
                privateKey: privKey,
            });
        }
        await waitForEpoch(dnr);
    });

    describe("when blacklisting", async () => {

        it("cannot set an invalid percentage", async () => {
            await slasher.setBlacklistSlashPercent(new BN("1001")).should.eventually.be.rejectedWith(/invalid percentage/);
            await slasher.setBlacklistSlashPercent(new BN("101")).should.eventually.be.rejectedWith(/invalid percentage/);
            await slasher.setBlacklistSlashPercent(new BN("1234")).should.eventually.be.rejectedWith(/invalid percentage/);
        });

        it("cannot blacklist twice", async () => {
            await slasher.blacklist(darknodes[4].account.address).should.eventually.not.be.rejected;
            await slasher.blacklist(darknodes[4].account.address).should.eventually.be.rejectedWith(/already blacklisted/);
        });

    });

    describe("when the signatures are the same", async () => {

        it("should not slash identical propose messages", async () => {
            const darknode = darknodes[0];
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const validRound1 = new BN("6345888412984379713");
            const proposeMsg1 = generateProposeMessage(height, round, blockhash1, validRound1);
            const hash1 = hashjs.sha256().update(proposeMsg1).digest('hex')
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknode.privateKey);
            const sigString1 = Ox(`${sig1.r.toString("hex")}${sig1.s.toString("hex")}${(sig1.v).toString(16)}`);

            await slasher.slashDuplicatePropose(
                height,
                round,
                hexBlockhash1,
                validRound1,
                sigString1,
                hexBlockhash1,
                validRound1,
                sigString1
            ).should.eventually.be.rejected;
        });

        it("should not slash identical prevote messages", async () => {
            const darknode = darknodes[0];
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const prevoteMsg1 = generatePrevoteMessage(height, round, blockhash1);
            const hash1 = hashjs.sha256().update(prevoteMsg1).digest('hex')
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknode.privateKey);
            const sigString1 = Ox(`${sig1.r.toString("hex")}${sig1.s.toString("hex")}${(sig1.v).toString(16)}`);

            await slasher.slashDuplicatePrevote(
                height,
                round,
                hexBlockhash1,
                sigString1,
                hexBlockhash1,
                sigString1
            ).should.eventually.be.rejected;
        });

        it("should not slash identical precommit messages", async () => {
            const darknode = darknodes[0];
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const precommitMsg1 = generatePrecommitMessage(height, round, blockhash1);
            const hash1 = hashjs.sha256().update(precommitMsg1).digest('hex')
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknode.privateKey);
            const sigString1 = Ox(`${sig1.r.toString("hex")}${sig1.s.toString("hex")}${(sig1.v).toString(16)}`);

            await slasher.slashDuplicatePrecommit(
                height,
                round,
                hexBlockhash1,
                sigString1,
                hexBlockhash1,
                sigString1
            ).should.eventually.be.rejected;
        });

    });

    describe("when the signers are different", async () => {

        it("should not slash for propose messages", async () => {
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const validRound1 = new BN("6345888412984379713");
            const proposeMsg1 = generateProposeMessage(height, round, blockhash1, validRound1);
            const hash1 = hashjs.sha256().update(proposeMsg1).digest('hex')
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknodes[0].privateKey);
            const sigString1 = Ox(`${sig1.r.toString("hex")}${sig1.s.toString("hex")}${(sig1.v).toString(16)}`);

            const blockhash2 = "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI";
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            const validRound2 = new BN("5327204637322492082");
            const proposeMsg2 = generateProposeMessage(height, round, blockhash2, validRound2);
            const hash2 = hashjs.sha256().update(proposeMsg2).digest('hex')
            const sig2 = ecsign(Buffer.from(hash2, "hex"), darknodes[1].privateKey);
            const sigString2 = Ox(`${sig2.r.toString("hex")}${sig2.s.toString("hex")}${(sig2.v).toString(16)}`);

            // first slash should pass
            await slasher.slashDuplicatePropose(
                height,
                round,
                hexBlockhash1,
                validRound1,
                sigString1,
                hexBlockhash2,
                validRound2,
                sigString2
            ).should.eventually.be.rejectedWith(/different signer/);
        });

        it("should not slash for prevote messages", async () => {
            const height = new BN("6349363483468961232");
            const round = new BN("3652348943894236532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const prevoteMsg1 = generatePrevoteMessage(height, round, blockhash1);
            const hash1 = hashjs.sha256().update(prevoteMsg1).digest('hex')
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknodes[0].privateKey);
            const sigString1 = Ox(`${sig1.r.toString("hex")}${sig1.s.toString("hex")}${(sig1.v).toString(16)}`);

            const blockhash2 = "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI";
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            const prevoteMsg2 = generatePrevoteMessage(height, round, blockhash2);
            const hash2 = hashjs.sha256().update(prevoteMsg2).digest('hex')
            const sig2 = ecsign(Buffer.from(hash2, "hex"), darknodes[1].privateKey);
            const sigString2 = Ox(`${sig2.r.toString("hex")}${sig2.s.toString("hex")}${(sig2.v).toString(16)}`);

            // first slash should pass
            await slasher.slashDuplicatePrevote(
                height,
                round,
                hexBlockhash1,
                sigString1,
                hexBlockhash2,
                sigString2
            ).should.eventually.be.rejectedWith(/different signer/);
        });

        it("should not slash for precommit messages", async () => {
            const height = new BN("6348943938419561232");
            const round = new BN("3652348939484336532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const precommitMsg1 = generatePrecommitMessage(height, round, blockhash1);
            const hash1 = hashjs.sha256().update(precommitMsg1).digest('hex')
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknodes[0].privateKey);
            const sigString1 = Ox(`${sig1.r.toString("hex")}${sig1.s.toString("hex")}${(sig1.v).toString(16)}`);

            const blockhash2 = "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI";
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            const precommitMsg2 = generatePrecommitMessage(height, round, blockhash2);
            const hash2 = hashjs.sha256().update(precommitMsg2).digest('hex')
            const sig2 = ecsign(Buffer.from(hash2, "hex"), darknodes[1].privateKey);
            const sigString2 = Ox(`${sig2.r.toString("hex")}${sig2.s.toString("hex")}${(sig2.v).toString(16)}`);

            // first slash should pass
            await slasher.slashDuplicatePrecommit(
                height,
                round,
                hexBlockhash1,
                sigString1,
                hexBlockhash2,
                sigString2
            ).should.eventually.be.rejectedWith(/different signer/);
        });
    });

    describe("when malicious messages are received", async () => {

        it("should slash duplicate proposals for the same height and round", async () => {
            const darknode = darknodes[0];
            const height = new BN("6343893498349561232");
            const round = new BN("3652348943983436532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const validRound1 = new BN("6345888412984379713");
            const proposeMsg1 = generateProposeMessage(height, round, blockhash1, validRound1);
            const hash1 = hashjs.sha256().update(proposeMsg1).digest('hex')
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknode.privateKey);
            const sigString1 = Ox(`${sig1.r.toString("hex")}${sig1.s.toString("hex")}${(sig1.v).toString(16)}`);

            const blockhash2 = "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI";
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            const validRound2 = new BN("5327204637322492082");
            const proposeMsg2 = generateProposeMessage(height, round, blockhash2, validRound2);
            const hash2 = hashjs.sha256().update(proposeMsg2).digest('hex')
            const sig2 = ecsign(Buffer.from(hash2, "hex"), darknode.privateKey);
            const sigString2 = Ox(`${sig2.r.toString("hex")}${sig2.s.toString("hex")}${(sig2.v).toString(16)}`);

            const caller = accounts[1];
            const darknodeBond = new BN(await dnr.getDarknodeBond(darknode.account.address));

            // first slash should pass
            await slasher.slashDuplicatePropose(
                height,
                round,
                hexBlockhash1,
                validRound1,
                sigString1,
                hexBlockhash2,
                validRound2,
                sigString2,
                {
                    from: caller,
                }
            ).should.eventually.not.be.rejected;

            const slashPercent = new BN(await slasher.maliciousSlashPercent());
            const slashedAmount = darknodeBond.div(new BN(100)).mul(slashPercent);

            const newDarknodeBond = new BN(await dnr.getDarknodeBond(darknode.account.address));
            newDarknodeBond.should.bignumber.equal(darknodeBond.sub(slashedAmount));

            // second slash should fail
            await slasher.slashDuplicatePropose(
                height,
                round,
                hexBlockhash1,
                validRound1,
                sigString1,
                hexBlockhash2,
                validRound2,
                sigString2,
                {
                    from: caller,
                }
            ).should.eventually.be.rejectedWith(/already slashed/);
        });

        it("should slash duplicate prevotes for the same height and round", async () => {
            const darknode = darknodes[2];
            const height = new BN("6343893498349561232");
            const round = new BN("3652348943983436532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const proposeMsg1 = generatePrevoteMessage(height, round, blockhash1);
            const hash1 = hashjs.sha256().update(proposeMsg1).digest('hex')
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknode.privateKey);
            const sigString1 = Ox(`${sig1.r.toString("hex")}${sig1.s.toString("hex")}${(sig1.v).toString(16)}`);

            const blockhash2 = "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI";
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            const proposeMsg2 = generatePrevoteMessage(height, round, blockhash2);
            const hash2 = hashjs.sha256().update(proposeMsg2).digest('hex')
            const sig2 = ecsign(Buffer.from(hash2, "hex"), darknode.privateKey);
            const sigString2 = Ox(`${sig2.r.toString("hex")}${sig2.s.toString("hex")}${(sig2.v).toString(16)}`);

            const caller = accounts[1];
            const darknodeBond = new BN(await dnr.getDarknodeBond(darknode.account.address));

            // first slash should pass
            await slasher.slashDuplicatePrevote(
                height,
                round,
                hexBlockhash1,
                sigString1,
                hexBlockhash2,
                sigString2,
                {
                    from: caller,
                }
            ).should.eventually.not.be.rejected;

            const slashPercent = new BN(await slasher.maliciousSlashPercent());
            const slashedAmount = darknodeBond.div(new BN(100)).mul(slashPercent);

            const newDarknodeBond = new BN(await dnr.getDarknodeBond(darknode.account.address));
            newDarknodeBond.should.bignumber.equal(darknodeBond.sub(slashedAmount));

            // second slash should fail
            await slasher.slashDuplicatePrevote(
                height,
                round,
                hexBlockhash1,
                sigString1,
                hexBlockhash2,
                sigString2,
                {
                    from: caller,
                }
            ).should.eventually.be.rejectedWith(/already slashed/);
        });

        it("should slash duplicate precommits for the same height and round", async () => {
            const darknode = darknodes[3];
            const height = new BN("4398348948349561232");
            const round = new BN("3348934843983436532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const proposeMsg1 = generatePrecommitMessage(height, round, blockhash1);
            const hash1 = hashjs.sha256().update(proposeMsg1).digest('hex')
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknode.privateKey);
            const sigString1 = Ox(`${sig1.r.toString("hex")}${sig1.s.toString("hex")}${(sig1.v).toString(16)}`);

            const blockhash2 = "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI";
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            const proposeMsg2 = generatePrecommitMessage(height, round, blockhash2);
            const hash2 = hashjs.sha256().update(proposeMsg2).digest('hex');
            const sig2 = ecsign(Buffer.from(hash2, "hex"), darknode.privateKey);
            const sigString2 = Ox(`${sig2.r.toString("hex")}${sig2.s.toString("hex")}${(sig2.v).toString(16)}`);

            const caller = accounts[1];
            const darknodeBond = new BN(await dnr.getDarknodeBond(darknode.account.address));

            // first slash should pass
            await slasher.slashDuplicatePrecommit(
                height,
                round,
                hexBlockhash1,
                sigString1,
                hexBlockhash2,
                sigString2,
                {
                    from: caller,
                }
            ).should.eventually.not.be.rejected;

            const slashPercent = new BN(await slasher.maliciousSlashPercent());
            const slashedAmount = darknodeBond.div(new BN(100)).mul(slashPercent);

            const newDarknodeBond = new BN(await dnr.getDarknodeBond(darknode.account.address));
            newDarknodeBond.should.bignumber.equal(darknodeBond.sub(slashedAmount));

            // second slash should fail
            await slasher.slashDuplicatePrecommit(
                height,
                round,
                hexBlockhash1,
                sigString1,
                hexBlockhash2,
                sigString2,
                {
                    from: caller,
                }
            ).should.eventually.be.rejectedWith(/already slashed/);
        });

    });

    // describe("when maliciously proposing", async () => {

    //     it("should slash when 2 proposals have the same height and round", async () => {
    //         const height=6349374925919561232;
    //         const round=3652381888914236532;
    //         const propose1 = generateProposeMessage(height, round, "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o", 6345888412984379713);
    //         const propose2 = generateProposeMessage(height, round, "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI", 5327204637322492082);
    //     });

    // });

});
