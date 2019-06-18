import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecsign } from "ethereumjs-util";
import { soliditySHA3 } from "ethereumjs-abi";

import { BTCShifterInstance, VestingInstance, zBTCInstance } from "../types/truffle-contracts";
import { increaseTime, NULL } from "./helper/testUtils";
import BigNumber from "bignumber.js";

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

    const month = 24 * 60 * 60 * 365 / 12;

    beforeEach(async () => {
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
        const duration = 6;

        const addVestingSchedule = async () => {
            const nonce = `0x${randomBytes(32).toString("hex")}`;

            const startTime = 0;
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
        }

        it("can add a vesting schedule", async () => {
            await addVestingSchedule();

            const schedule = await vesting.schedules(beneficiary);
            (schedule as any).startTime.should.bignumber.not.equal(new BN(0));
            (schedule as any).amount.should.bignumber.equal(amountAfterFee);
            (schedule as any).duration.should.bignumber.equal(new BN(duration));
        });

        // Calculate the claimable amount after a given number of elapsed months.
        const amountClaimable = (elapsedMonths: number): BN => {
            const amountBN = new BigNumber(amountAfterFee.toString());
            const resultBN = amountBN.times(new BigNumber(elapsedMonths)).dividedToIntegerBy(new BigNumber(duration));
            return new BN(resultBN.toString());
        }

        it("can check claimable amount", async () => {
            let claimable = await vesting.calculateClaimable(beneficiary);
            claimable[0].should.bignumber.equal(new BN(0));
            claimable[1].should.bignumber.equal(new BN(0));

            await addVestingSchedule();

            claimable = await vesting.calculateClaimable(beneficiary);
            claimable[0].should.bignumber.equal(new BN(0));
            claimable[1].should.bignumber.equal(new BN(0));

            for (let i = 1; i <= duration; i++) {
                await increaseTime(month);

                claimable = await vesting.calculateClaimable(beneficiary);
                claimable[0].should.bignumber.equal(new BN(i));
                claimable[1].should.bignumber.equal(amountClaimable(i));
            }
        });

        it("can claim vested bitcoin", async () => {
            await addVestingSchedule();

            // Claim after 3 months.
            await increaseTime(month * 3);

            let claimable = await vesting.calculateClaimable(beneficiary);
            claimable[0].should.bignumber.equal(new BN(3));
            claimable[1].should.bignumber.equal(amountClaimable(3));

            await vesting.claim(beneficiary, { from: beneficiary });

            // Claim remaining at the end of the vesting period.
            await increaseTime(month * (duration - 3));

            claimable = await vesting.calculateClaimable(beneficiary);
            claimable[0].should.bignumber.equal(new BN(duration - 3));
            claimable[1].should.bignumber.equal(amountAfterFee.sub(amountClaimable(3)));

            await vesting.claim(beneficiary, { from: beneficiary });

            claimable = await vesting.calculateClaimable(beneficiary);
            claimable[0].should.bignumber.equal(new BN(0));
            claimable[1].should.bignumber.equal(new BN(0));
        });

        it("cannot claim more than the allocated amount of bitcoin", async () => {
            await addVestingSchedule();

            // Claim well after vesting period has ended.
            await increaseTime(month * duration * 10);

            const claimable = await vesting.calculateClaimable(beneficiary);
            claimable[0].should.bignumber.equal(new BN(duration));
            claimable[1].should.bignumber.equal(amountAfterFee);
        });
    });
});