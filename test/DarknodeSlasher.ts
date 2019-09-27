import BN from "bn.js";

import hashjs from 'hash.js';
// import { config } from "../migrations/networks";
import {
    DarknodeRegistryInstance, DarknodeRegistryStoreInstance, DarknodeSlasherInstance,
    RenTokenInstance,
} from "../types/truffle-contracts";
import { Account } from "web3-eth-accounts";
import { ecsign } from "ethereumjs-util";
import { Ox } from "./helper/testUtils";
// import {
//     ID, MINIMUM_BOND, MINIMUM_EPOCH_INTERVAL_SECONDS, MINIMUM_POD_SIZE, NULL, PUBK, waitForEpoch,
// } from "./helper/testUtils";

// const RenToken = artifacts.require("RenToken");
// const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
// const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");

contract("DarknodeSlasher", (accounts: string[]) => {

    // let ren: RenTokenInstance;
    // let dnrs: DarknodeRegistryStoreInstance;
    // let dnr: DarknodeRegistryInstance;
    let slasher: DarknodeSlasherInstance;
    let darknode1: Account;
    let privKey: Buffer;


    before(async () => {
        // ren = await RenToken.deployed();
        // dnrs = await DarknodeRegistryStore.deployed();
        // dnr = await DarknodeRegistry.deployed();
        slasher = await DarknodeSlasher.deployed();
        // await dnr.updateSlasher(slasher.address);
        // await dnr.epoch({ from: accounts[1] }).should.be.rejectedWith(/not authorized/);
        // await waitForEpoch(dnr);

        // for (let i = 1; i < accounts.length; i++) {
        //     await ren.transfer(accounts[i], MINIMUM_BOND);
        // }
        darknode1 = web3.eth.accounts.create();
        privKey = Buffer.from(darknode1.privateKey.slice(2), "hex");
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

        it("should recover the signer of a message", async () => {
            const height = new BN("6349374925919561232");
            const round = new BN("3652381888914236532");
            const blockhash = "XTsJ2rO2yD47tg3JfmakVRXLzeou4SMtZvsMc6lkr6o";
            const hexBlockhash = web3.utils.asciiToHex(blockhash);
            const validRound = new BN("6345888412984379713");
            const proposeMsg = generateProposeMessage(height, round, blockhash, validRound);
            const hash = hashjs.sha256().update(proposeMsg).digest('hex')
            const sig = ecsign(Buffer.from(hash, "hex"), privKey);
            const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);
            const signer = await slasher.recoverPropose(height, round, hexBlockhash, validRound, sigString);
            signer.should.equal(darknode1.address);
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
