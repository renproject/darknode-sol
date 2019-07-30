import BigNumber from "bignumber.js";
import BN from "bn.js";
import { rawEncode } from "ethereumjs-abi";
import { ecsign, keccak256 } from "ethereumjs-util";

import {
    BTCShifterInstance, ShifterRegistryInstance, VestingInstance, zBTCInstance,
} from "../types/truffle-contracts";
import { increaseTime, Ox, randomBytes } from "./helper/testUtils";

const BTCShifter = artifacts.require("BTCShifter");
const ShifterRegistry = artifacts.require("ShifterRegistry");
const zBTC = artifacts.require("zBTC");
const Vesting = artifacts.require("Vesting");

contract("Vesting", (accounts) => {
    let btcShifter: BTCShifterInstance;
    let zbtc: zBTCInstance;
    let vesting: VestingInstance;
    let registry: ShifterRegistryInstance;

    const mintAuthority = web3.eth.accounts.create();
    const privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex");
    const feeInBips = new BN(10);
    const feeRecipient = accounts[1];

    const month = 24 * 60 * 60 * 365 / 12;

    beforeEach(async () => {
        // Setup the environment
        zbtc = await zBTC.new();

        btcShifter = await BTCShifter.new(
            zbtc.address,
            feeRecipient,
            mintAuthority.address,
            feeInBips,
            10000,
        );

        await zbtc.transferOwnership(btcShifter.address);
        await btcShifter.claimTokenOwnership();

        registry = await ShifterRegistry.new();
        await registry.setShifter(zbtc.address, btcShifter.address);

        // Setup the contracts for testing
        vesting = await Vesting.new(registry.address);
    });

    describe("can vest bitcoin", () => {
        const beneficiary = accounts[2];
        const amount = new BN(200000);
        const amountAfterFee = new BN(199800);
        const duration = 6;

        const addVestingSchedule = async () => {
            const nonce = randomBytes(32);

            const startTime = 0;
            const pHash = keccak256(rawEncode(
                ["address", "uint256", "uint16"],
                [beneficiary, startTime, duration],
            )).toString("hex");

            const hashForSignature = await btcShifter.hashForSignature(
                Ox(pHash),
                amount.toNumber(),
                vesting.address,
                nonce,
            );
            const sig = ecsign(Buffer.from(hashForSignature.slice(2), "hex"), privKey);
            const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

            // User should have no schedules prior to adding.
            const schedule = await vesting.schedules(beneficiary);
            (schedule as any).startTime.should.bignumber.equal(new BN(0));

            await vesting.addVestingSchedule(
                // Payload
                beneficiary, startTime, duration,
                // Required
                amount, nonce, sigString,
            );
        };

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
        };

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
