import BN from "bn.js";

import hashjs from 'hash.js';
// import { config } from "../migrations/networks";
import {
    DarknodeRegistryInstance, DarknodeRegistryStoreInstance, DarknodeSlasherInstance,
    RenTokenInstance,
    DarknodePaymentStoreInstance,
} from "../types/truffle-contracts";
import { Account } from "web3-eth-accounts";
import { ecsign } from "ethereumjs-util";
import { Ox } from "./helper/testUtils";
import {
    ID, MINIMUM_BOND, MINIMUM_EPOCH_INTERVAL_SECONDS, MINIMUM_POD_SIZE, NULL, PUBK, waitForEpoch,
} from "./helper/testUtils";

const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const RenToken = artifacts.require("RenToken");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");

interface Darknode {
    account: Account;
    privateKey: Buffer;
}

const numDarknodes = 2;

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

    describe("when generating messages", async () => {

        it("should correctly generate the propose message", async () => {
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash = web3.utils.asciiToHex(blockhash);
            const validRound = new BN("6345888412984379713");
            const proposeMsg = generateProposeMessage(height, round, blockhash, validRound);
            const rawMsg = await slasher.proposeMessage(height, round, hexBlockhash, validRound);
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
            const signer = await slasher.recoverPropose(height, round, hexBlockhash, validRound, sigString);
            signer.should.equal(darknode.account.address);
        });

        it("cannot slash when the same data is given twice", async () => {
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

        it("cannot slash when the signers are different", async () => {
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

        it("should slash duplicate proposals for the same height and round", async () => {
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

    });

    // describe("when maliciously proposing", async () => {

    //     it("should slash when 2 proposals have the same height and round", async () => {
    //         const height=6349374925919561232;
    //         const round=3652381888914236532;
    //         const propose1 = generateProposeMessage(height, round, "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o", 6345888412984379713);
    //         const propose2 = generateProposeMessage(height, round, "41RLyhshTwmPyAwjPM8AmReOB/q4LLdvYpDMKt1bEFI", 5327204637322492082);
    //     });

    // });

    const generateProposeMessage = (height: BN, round: BN, blockHash: string, validRound: BN): string => {
        return `Propose(Height=${height.toString()},Round=${round.toString()},BlockHash=${blockHash},ValidRound=${validRound.toString()})`;
    }

});
