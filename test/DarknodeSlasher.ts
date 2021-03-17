import BN from "bn.js";
import { ecsign } from "ethereumjs-util";
import hashjs from "hash.js";

// import { config } from "../migrations/networks";
import {
    DarknodeRegistryLogicV1Instance,
    DarknodeSlasherInstance,
    RenTokenInstance
} from "../types/truffle-contracts";
import { MINIMUM_BOND, NULL, Ox, PUBK, waitForEpoch } from "./helper/testUtils";
import {
    Darknode,
    generatePrecommitMessage,
    generatePrevoteMessage,
    generateProposeMessage,
    generateSecretMessage
} from "./Validate";

const RenToken = artifacts.require("RenToken");
const DarknodeRegistryLogicV1 = artifacts.require("DarknodeRegistryLogicV1");
const DarknodeRegistryProxy = artifacts.require("DarknodeRegistryProxy");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");

const numDarknodes = 5;

contract("DarknodeSlasher", (accounts: string[]) => {
    let ren: RenTokenInstance;
    let dnr: DarknodeRegistryLogicV1Instance;
    let slasher: DarknodeSlasherInstance;
    const darknodes = new Array<Darknode>();

    const owner = accounts[0];

    before(async () => {
        ren = await RenToken.deployed();
        const dnrProxy = await DarknodeRegistryProxy.deployed();
        dnr = await DarknodeRegistryLogicV1.at(dnrProxy.address);
        slasher = await DarknodeSlasher.deployed();
        await dnr.updateSlasher(slasher.address);
        await waitForEpoch(dnr);

        for (let i = 0; i < numDarknodes; i++) {
            const darknode = web3.eth.accounts.create();
            const privKey = Buffer.from(darknode.privateKey.slice(2), "hex");

            // top up the darknode address with 1 ETH
            await web3.eth.sendTransaction({
                to: darknode.address,
                from: owner,
                value: web3.utils.toWei("1")
            });
            await web3.eth.personal.importRawKey(darknode.privateKey, "");
            await web3.eth.personal.unlockAccount(darknode.address, "", 6000);

            // transfer ren and register darknode
            await ren.transfer(darknode.address, MINIMUM_BOND);
            await ren.approve(dnr.address, MINIMUM_BOND, {
                from: darknode.address
            });
            // Register the darknodes under the account address
            await dnr.register(darknode.address, PUBK(darknode.address), {
                from: darknode.address
            });
            darknodes.push({
                account: darknode,
                privateKey: privKey
            });
        }
        await waitForEpoch(dnr);
    });

    describe("when setting percentages", async () => {
        it("can set a valid blacklist percentage", async () => {
            const p1 = new BN("1");
            await slasher.setBlacklistSlashPercent(p1);
            (await slasher.blacklistSlashPercent.call()).should.bignumber.equal(
                p1
            );
            const p2 = new BN("10");
            await slasher.setBlacklistSlashPercent(p2);
            (await slasher.blacklistSlashPercent.call()).should.bignumber.equal(
                p2
            );
            const p3 = new BN("12");
            await slasher.setBlacklistSlashPercent(p3);
            (await slasher.blacklistSlashPercent.call()).should.bignumber.equal(
                p3
            );
        });

        it("can set a valid malicious percentage", async () => {
            const p1 = new BN("1");
            await slasher.setMaliciousSlashPercent(p1);
            (await slasher.maliciousSlashPercent.call()).should.bignumber.equal(
                p1
            );
            const p2 = new BN("10");
            await slasher.setMaliciousSlashPercent(p2);
            (await slasher.maliciousSlashPercent.call()).should.bignumber.equal(
                p2
            );
            const p3 = new BN("12");
            await slasher.setMaliciousSlashPercent(p3);
            (await slasher.maliciousSlashPercent.call()).should.bignumber.equal(
                p3
            );
        });

        it("can set a valid secret reveal percentage", async () => {
            const p1 = new BN("1");
            await slasher.setSecretRevealSlashPercent(p1);
            (
                await slasher.secretRevealSlashPercent.call()
            ).should.bignumber.equal(p1);
            const p2 = new BN("10");
            await slasher.setSecretRevealSlashPercent(p2);
            (
                await slasher.secretRevealSlashPercent.call()
            ).should.bignumber.equal(p2);
            const p3 = new BN("12");
            await slasher.setSecretRevealSlashPercent(p3);
            (
                await slasher.secretRevealSlashPercent.call()
            ).should.bignumber.equal(p3);
        });

        it("cannot set an invalid blacklist percentage", async () => {
            await slasher
                .setBlacklistSlashPercent(new BN("1001"))
                .should.be.rejectedWith(/DarknodeSlasher: invalid percentage/);
            await slasher
                .setBlacklistSlashPercent(new BN("101"))
                .should.be.rejectedWith(/DarknodeSlasher: invalid percentage/);
            await slasher
                .setBlacklistSlashPercent(new BN("1234"))
                .should.be.rejectedWith(/DarknodeSlasher: invalid percentage/);
        });

        it("cannot set an invalid malicious percentage", async () => {
            await slasher
                .setMaliciousSlashPercent(new BN("1001"))
                .should.be.rejectedWith(/DarknodeSlasher: invalid percentage/);
            await slasher
                .setMaliciousSlashPercent(new BN("101"))
                .should.be.rejectedWith(/DarknodeSlasher: invalid percentage/);
            await slasher
                .setMaliciousSlashPercent(new BN("1234"))
                .should.be.rejectedWith(/DarknodeSlasher: invalid percentage/);
        });

        it("cannot set an invalid secret reveal percentage", async () => {
            await slasher
                .setSecretRevealSlashPercent(new BN("1001"))
                .should.be.rejectedWith(/DarknodeSlasher: invalid percentage/);
            await slasher
                .setSecretRevealSlashPercent(new BN("101"))
                .should.be.rejectedWith(/DarknodeSlasher: invalid percentage/);
            await slasher
                .setSecretRevealSlashPercent(new BN("1234"))
                .should.be.rejectedWith(/DarknodeSlasher: invalid percentage/);
        });
    });

    describe("when blacklisting", async () => {
        it("cannot blacklist twice", async () => {
            await slasher.blacklist(darknodes[4].account.address);
            await slasher
                .blacklist(darknodes[4].account.address)
                .should.be.rejectedWith(/DarknodeSlasher: already blacklisted/);
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
            const proposeMsg1 = generateProposeMessage(
                height,
                round,
                blockhash1,
                validRound1
            );
            const hash1 = hashjs
                .sha256()
                .update(proposeMsg1)
                .digest("hex");
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknode.privateKey);
            const sigString1 = Ox(
                `${sig1.r.toString("hex")}${sig1.s.toString(
                    "hex"
                )}${sig1.v.toString(16)}`
            );

            await slasher
                .slashDuplicatePropose(
                    height,
                    round,
                    hexBlockhash1,
                    validRound1,
                    sigString1,
                    hexBlockhash1,
                    validRound1,
                    sigString1
                )
                .should.be.rejectedWith(/Validate: same signature/);
        });

        it("should not slash identical prevote messages", async () => {
            const darknode = darknodes[0];
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const prevoteMsg1 = generatePrevoteMessage(
                height,
                round,
                blockhash1
            );
            const hash1 = hashjs
                .sha256()
                .update(prevoteMsg1)
                .digest("hex");
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknode.privateKey);
            const sigString1 = Ox(
                `${sig1.r.toString("hex")}${sig1.s.toString(
                    "hex"
                )}${sig1.v.toString(16)}`
            );

            await slasher
                .slashDuplicatePrevote(
                    height,
                    round,
                    hexBlockhash1,
                    sigString1,
                    hexBlockhash1,
                    sigString1
                )
                .should.be.rejectedWith(/Validate: same signature/);
        });

        it("should not slash identical precommit messages", async () => {
            const darknode = darknodes[0];
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const precommitMsg1 = generatePrecommitMessage(
                height,
                round,
                blockhash1
            );
            const hash1 = hashjs
                .sha256()
                .update(precommitMsg1)
                .digest("hex");
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknode.privateKey);
            const sigString1 = Ox(
                `${sig1.r.toString("hex")}${sig1.s.toString(
                    "hex"
                )}${sig1.v.toString(16)}`
            );

            await slasher
                .slashDuplicatePrecommit(
                    height,
                    round,
                    hexBlockhash1,
                    sigString1,
                    hexBlockhash1,
                    sigString1
                )
                .should.be.rejectedWith(/Validate: same signature/);
        });
    });

    describe("when the signers are different", async () => {
        it("should not slash for propose messages", async () => {
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const validRound1 = new BN("6345888412984379713");
            const proposeMsg1 = generateProposeMessage(
                height,
                round,
                blockhash1,
                validRound1
            );
            const hash1 = hashjs
                .sha256()
                .update(proposeMsg1)
                .digest("hex");
            const sig1 = ecsign(
                Buffer.from(hash1, "hex"),
                darknodes[0].privateKey
            );
            const sigString1 = Ox(
                `${sig1.r.toString("hex")}${sig1.s.toString(
                    "hex"
                )}${sig1.v.toString(16)}`
            );

            const blockhash2 = "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI";
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            const validRound2 = new BN("5327204637322492082");
            const proposeMsg2 = generateProposeMessage(
                height,
                round,
                blockhash2,
                validRound2
            );
            const hash2 = hashjs
                .sha256()
                .update(proposeMsg2)
                .digest("hex");
            const sig2 = ecsign(
                Buffer.from(hash2, "hex"),
                darknodes[1].privateKey
            );
            const sigString2 = Ox(
                `${sig2.r.toString("hex")}${sig2.s.toString(
                    "hex"
                )}${sig2.v.toString(16)}`
            );

            // first slash should pass
            await slasher
                .slashDuplicatePropose(
                    height,
                    round,
                    hexBlockhash1,
                    validRound1,
                    sigString1,
                    hexBlockhash2,
                    validRound2,
                    sigString2
                )
                .should.be.rejectedWith(/Validate: different signer/);
        });

        it("should not slash for prevote messages", async () => {
            const height = new BN("6349363483468961232");
            const round = new BN("3652348943894236532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const prevoteMsg1 = generatePrevoteMessage(
                height,
                round,
                blockhash1
            );
            const hash1 = hashjs
                .sha256()
                .update(prevoteMsg1)
                .digest("hex");
            const sig1 = ecsign(
                Buffer.from(hash1, "hex"),
                darknodes[0].privateKey
            );
            const sigString1 = Ox(
                `${sig1.r.toString("hex")}${sig1.s.toString(
                    "hex"
                )}${sig1.v.toString(16)}`
            );

            const blockhash2 = "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI";
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            const prevoteMsg2 = generatePrevoteMessage(
                height,
                round,
                blockhash2
            );
            const hash2 = hashjs
                .sha256()
                .update(prevoteMsg2)
                .digest("hex");
            const sig2 = ecsign(
                Buffer.from(hash2, "hex"),
                darknodes[1].privateKey
            );
            const sigString2 = Ox(
                `${sig2.r.toString("hex")}${sig2.s.toString(
                    "hex"
                )}${sig2.v.toString(16)}`
            );

            // first slash should pass
            await slasher
                .slashDuplicatePrevote(
                    height,
                    round,
                    hexBlockhash1,
                    sigString1,
                    hexBlockhash2,
                    sigString2
                )
                .should.be.rejectedWith(/Validate: different signer/);
        });

        it("should not slash for precommit messages", async () => {
            const height = new BN("6348943938419561232");
            const round = new BN("3652348939484336532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const precommitMsg1 = generatePrecommitMessage(
                height,
                round,
                blockhash1
            );
            const hash1 = hashjs
                .sha256()
                .update(precommitMsg1)
                .digest("hex");
            const sig1 = ecsign(
                Buffer.from(hash1, "hex"),
                darknodes[0].privateKey
            );
            const sigString1 = Ox(
                `${sig1.r.toString("hex")}${sig1.s.toString(
                    "hex"
                )}${sig1.v.toString(16)}`
            );

            const blockhash2 = "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI";
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            const precommitMsg2 = generatePrecommitMessage(
                height,
                round,
                blockhash2
            );
            const hash2 = hashjs
                .sha256()
                .update(precommitMsg2)
                .digest("hex");
            const sig2 = ecsign(
                Buffer.from(hash2, "hex"),
                darknodes[1].privateKey
            );
            const sigString2 = Ox(
                `${sig2.r.toString("hex")}${sig2.s.toString(
                    "hex"
                )}${sig2.v.toString(16)}`
            );

            // first slash should pass
            await slasher
                .slashDuplicatePrecommit(
                    height,
                    round,
                    hexBlockhash1,
                    sigString1,
                    hexBlockhash2,
                    sigString2
                )
                .should.be.rejectedWith(/Validate: different signer/);
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
            const proposeMsg1 = generateProposeMessage(
                height,
                round,
                blockhash1,
                validRound1
            );
            const hash1 = hashjs
                .sha256()
                .update(proposeMsg1)
                .digest("hex");
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknode.privateKey);
            const sigString1 = Ox(
                `${sig1.r.toString("hex")}${sig1.s.toString(
                    "hex"
                )}${sig1.v.toString(16)}`
            );

            const blockhash2 = "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI";
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            const validRound2 = new BN("5327204637322492082");
            const proposeMsg2 = generateProposeMessage(
                height,
                round,
                blockhash2,
                validRound2
            );
            const hash2 = hashjs
                .sha256()
                .update(proposeMsg2)
                .digest("hex");
            const sig2 = ecsign(Buffer.from(hash2, "hex"), darknode.privateKey);
            const sigString2 = Ox(
                `${sig2.r.toString("hex")}${sig2.s.toString(
                    "hex"
                )}${sig2.v.toString(16)}`
            );

            const caller = accounts[1];
            const darknodeBond = new BN(
                await dnr.getDarknodeBond.call(darknode.account.address)
            );

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
                    from: caller
                }
            );

            const slashPercent = new BN(
                await slasher.maliciousSlashPercent.call()
            );
            const slashedAmount = darknodeBond
                .div(new BN(100))
                .mul(slashPercent);

            const newDarknodeBond = new BN(
                await dnr.getDarknodeBond.call(darknode.account.address)
            );
            newDarknodeBond.should.bignumber.equal(
                darknodeBond.sub(slashedAmount)
            );

            // second slash should fail
            await slasher
                .slashDuplicatePropose(
                    height,
                    round,
                    hexBlockhash1,
                    validRound1,
                    sigString1,
                    hexBlockhash2,
                    validRound2,
                    sigString2,
                    {
                        from: caller
                    }
                )
                .should.be.rejectedWith(/DarknodeSlasher: already slashed/);
        });

        it("should slash duplicate prevotes for the same height and round", async () => {
            const darknode = darknodes[2];
            const height = new BN("6343893498349561232");
            const round = new BN("3652348943983436532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const proposeMsg1 = generatePrevoteMessage(
                height,
                round,
                blockhash1
            );
            const hash1 = hashjs
                .sha256()
                .update(proposeMsg1)
                .digest("hex");
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknode.privateKey);
            const sigString1 = Ox(
                `${sig1.r.toString("hex")}${sig1.s.toString(
                    "hex"
                )}${sig1.v.toString(16)}`
            );

            const blockhash2 = "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI";
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            const proposeMsg2 = generatePrevoteMessage(
                height,
                round,
                blockhash2
            );
            const hash2 = hashjs
                .sha256()
                .update(proposeMsg2)
                .digest("hex");
            const sig2 = ecsign(Buffer.from(hash2, "hex"), darknode.privateKey);
            const sigString2 = Ox(
                `${sig2.r.toString("hex")}${sig2.s.toString(
                    "hex"
                )}${sig2.v.toString(16)}`
            );

            const caller = accounts[1];
            const darknodeBond = new BN(
                await dnr.getDarknodeBond.call(darknode.account.address)
            );

            // first slash should pass
            await slasher.slashDuplicatePrevote(
                height,
                round,
                hexBlockhash1,
                sigString1,
                hexBlockhash2,
                sigString2,
                {
                    from: caller
                }
            );

            const slashPercent = new BN(
                await slasher.maliciousSlashPercent.call()
            );
            const slashedAmount = darknodeBond
                .div(new BN(100))
                .mul(slashPercent);

            const newDarknodeBond = new BN(
                await dnr.getDarknodeBond.call(darknode.account.address)
            );
            newDarknodeBond.should.bignumber.equal(
                darknodeBond.sub(slashedAmount)
            );

            // second slash should fail
            await slasher
                .slashDuplicatePrevote(
                    height,
                    round,
                    hexBlockhash1,
                    sigString1,
                    hexBlockhash2,
                    sigString2,
                    {
                        from: caller
                    }
                )
                .should.be.rejectedWith(/DarknodeSlasher: already slashed/);
        });

        it("should slash duplicate precommits for the same height and round", async () => {
            const darknode = darknodes[3];
            const height = new BN("4398348948349561232");
            const round = new BN("3348934843983436532");
            const blockhash1 = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash1 = web3.utils.asciiToHex(blockhash1);
            const proposeMsg1 = generatePrecommitMessage(
                height,
                round,
                blockhash1
            );
            const hash1 = hashjs
                .sha256()
                .update(proposeMsg1)
                .digest("hex");
            const sig1 = ecsign(Buffer.from(hash1, "hex"), darknode.privateKey);
            const sigString1 = Ox(
                `${sig1.r.toString("hex")}${sig1.s.toString(
                    "hex"
                )}${sig1.v.toString(16)}`
            );

            const blockhash2 = "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI";
            const hexBlockhash2 = web3.utils.asciiToHex(blockhash2);
            const proposeMsg2 = generatePrecommitMessage(
                height,
                round,
                blockhash2
            );
            const hash2 = hashjs
                .sha256()
                .update(proposeMsg2)
                .digest("hex");
            const sig2 = ecsign(Buffer.from(hash2, "hex"), darknode.privateKey);
            const sigString2 = Ox(
                `${sig2.r.toString("hex")}${sig2.s.toString(
                    "hex"
                )}${sig2.v.toString(16)}`
            );

            const caller = accounts[1];
            const darknodeBond = new BN(
                await dnr.getDarknodeBond.call(darknode.account.address)
            );

            // first slash should pass
            await slasher.slashDuplicatePrecommit(
                height,
                round,
                hexBlockhash1,
                sigString1,
                hexBlockhash2,
                sigString2,
                {
                    from: caller
                }
            );

            const slashPercent = new BN(
                await slasher.maliciousSlashPercent.call()
            );
            const slashedAmount = darknodeBond
                .div(new BN(100))
                .mul(slashPercent);

            const newDarknodeBond = new BN(
                await dnr.getDarknodeBond.call(darknode.account.address)
            );
            newDarknodeBond.should.bignumber.equal(
                darknodeBond.sub(slashedAmount)
            );

            // second slash should fail
            await slasher
                .slashDuplicatePrecommit(
                    height,
                    round,
                    hexBlockhash1,
                    sigString1,
                    hexBlockhash2,
                    sigString2,
                    {
                        from: caller
                    }
                )
                .should.be.rejectedWith(/DarknodeSlasher: already slashed/);
        });

        it("should slash when a secret message is revealed", async () => {
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
            // first slash should succeed
            await slasher.slashSecretReveal(a, b, c, d, e, f, sigString);
            // second slash should fail
            await slasher
                .slashSecretReveal(a, b, c, d, e, f, sigString)
                .should.be.rejectedWith(/DarknodeSlasher: already slashed/);
        });
    });

    it("can update DarknodeRegistry", async () => {
        const darknodeRegistry = await slasher.darknodeRegistry.call();
        await slasher
            .updateDarknodeRegistry(NULL)
            .should.be.rejectedWith(
                /DarknodeSlasher: invalid Darknode Registry address/
            );

        await slasher.updateDarknodeRegistry(accounts[0]);
        await slasher.updateDarknodeRegistry(darknodeRegistry);
    });
});
