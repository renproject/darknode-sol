import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecsign } from "ethereumjs-util";
import { soliditySHA3 } from "ethereumjs-abi";

import { BTCShifterInstance, VestingInstance, zBTCInstance } from "../types/truffle-contracts";
import { NULL } from "./helper/testUtils";

const BTCShifter = artifacts.require("BTCShifter");
const zBTC = artifacts.require("zBTC");
const Vesting = artifacts.require("Vesting");

contract("Vesting", (accounts) => {
    let btcShifter: BTCShifterInstance;
    let zbtc: zBTCInstance;
    let vesting: VestingInstance;

    const mintAuthority = web3.eth.accounts.create();
    const privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex");
    const feeInBips = new BN(10);
    const feeRecipient = accounts[1];

    before(async () => {
        zbtc = await zBTC.new();

        btcShifter = await BTCShifter.new(
            NULL,
            zbtc.address,
            feeRecipient,
            mintAuthority.address,
            feeInBips,
        );

        vesting = await Vesting.new(btcShifter.address);

        await zbtc.transferOwnership(btcShifter.address);
        await btcShifter.claimTokenOwnership();
    });

    describe("can vest bitcoin", () => {
        const beneficiary = accounts[2];
        const amount = new BN(200000);
        const amountAfterFee = new BN(199800);

        it("can add a vesting schedule", async () => {
            const nonce = `0x${randomBytes(32).toString("hex")}`;

            const startTime = 0;
            const duration = 6;
            const phash = soliditySHA3(
                ["address", "uint256", "uint16"],
                [new BN(beneficiary, 16), startTime, duration]
            ).toString("hex");

            const sigHash = await btcShifter.sigHash(vesting.address, amount.toNumber(), nonce, `0x${phash}`);
            const sig = ecsign(Buffer.from(sigHash.slice(2), "hex"), privKey);
            const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;

            // User should have no schedules prior to adding.
            let schedule = await vesting.schedules(beneficiary);
            (schedule as any).startTime.should.bignumber.equal(new BN(0));

            await vesting.addVestingSchedule(amount, nonce, sigString, beneficiary, startTime, duration);

            schedule = await vesting.schedules(beneficiary);
            (schedule as any).startTime.should.bignumber.not.equal(new BN(0));
        });
    });
});