import BigNumber from "bignumber.js";
import BN from "bn.js";
import { rawEncode } from "ethereumjs-abi";
import { ecsign, keccak256 } from "ethereumjs-util";

import {
    BTCGatewayInstance, GatewayRegistryInstance, RenERC20Instance, VestingInstance,
} from "../types/truffle-contracts";
import { deployProxy, increaseTime, Ox, randomBytes } from "./helper/testUtils";

const BTCGateway = artifacts.require("BTCGateway");
const GatewayRegistry = artifacts.require("GatewayRegistry");
const renBTC = artifacts.require("renBTC");
const RenERC20 = artifacts.require("RenERC20");
const Vesting = artifacts.require("Vesting");

contract.skip("Vesting", ([owner, feeRecipient, beneficiary, proxyGovernanceAddress]) => {
    let btcGateway: BTCGatewayInstance;
    let renbtc: RenERC20Instance;
    let vesting: VestingInstance;
    let registry: GatewayRegistryInstance;

    const mintAuthority = web3.eth.accounts.create();
    const privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex");
    const feeInBips = new BN(10);

    const month = 24 * 60 * 60 * 365 / 12;

    beforeEach(async () => {
        // Setup the environment
        renbtc = await deployProxy<RenERC20Instance>(web3, renBTC, RenERC20, proxyGovernanceAddress, [{ type: "uint256", value: await web3.eth.net.getId() }, { type: "address", value: owner }, { type: "uint256", value: "500000000000000000" }, { type: "string", value: "1" }, { type: "string", value: "renBTC" }, { type: "string", value: "renBTC" }, { type: "uint8", value: 8 }], { from: owner });

        btcGateway = await BTCGateway.new(
            renbtc.address,
            feeRecipient,
            mintAuthority.address,
            feeInBips,
            feeInBips,
            10000,
        );

        await renbtc.transferOwnership(btcGateway.address);
        await btcGateway.claimTokenOwnership();

        registry = await GatewayRegistry.new();
        await registry.setGateway(renbtc.address, btcGateway.address);

        // Setup the contracts for testing
        vesting = await Vesting.new(registry.address);
    });

    describe("can vest bitcoin", () => {
        const amount = new BN(200000);
        const amountAfterFee = new BN(199800);
        const duration = 6;

        const addVestingSchedule = async () => {
            const nHash = randomBytes(32);

            const startTime = 0;
            const pHash = keccak256(rawEncode(
                ["address", "uint256", "uint16"],
                [beneficiary, startTime, duration],
            )).toString("hex");

            const hashForSignature = await btcGateway.hashForSignature.call(
                Ox(pHash),
                amount.toNumber(),
                vesting.address,
                nHash,
            );
            const sig = ecsign(Buffer.from(hashForSignature.slice(2), "hex"), privKey);
            const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

            // User should have no schedules prior to adding.
            const schedule = await vesting.schedules.call(beneficiary);
            (schedule as any).startTime.should.bignumber.equal(new BN(0));

            await vesting.addVestingSchedule(
                // Payload
                beneficiary, startTime, duration,
                // Required
                amount, nHash, sigString,
            );
        };

        it("can add a vesting schedule", async () => {
            await addVestingSchedule();

            const schedule = await vesting.schedules.call(beneficiary);
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
            let claimable = await vesting.calculateClaimable.call(beneficiary);
            claimable[0].should.bignumber.equal(new BN(0));
            claimable[1].should.bignumber.equal(new BN(0));

            await addVestingSchedule();

            claimable = await vesting.calculateClaimable.call(beneficiary);
            claimable[0].should.bignumber.equal(new BN(0));
            claimable[1].should.bignumber.equal(new BN(0));

            for (let i = 1; i <= duration; i++) {
                await increaseTime(month);

                claimable = await vesting.calculateClaimable.call(beneficiary);
                claimable[0].should.bignumber.equal(new BN(i));
                claimable[1].should.bignumber.equal(amountClaimable(i));
            }
        });

        it("can claim vested bitcoin", async () => {
            await addVestingSchedule();

            // Claim after 3 months.
            await increaseTime(month * 3);

            let claimable = await vesting.calculateClaimable.call(beneficiary);
            claimable[0].should.bignumber.equal(new BN(3));
            claimable[1].should.bignumber.equal(amountClaimable(3));

            await vesting.claim(beneficiary, { from: beneficiary });

            // Claim remaining at the end of the vesting period.
            await increaseTime(month * (duration - 3));

            claimable = await vesting.calculateClaimable.call(beneficiary);
            claimable[0].should.bignumber.equal(new BN(duration - 3));
            claimable[1].should.bignumber.equal(amountAfterFee.sub(amountClaimable(3)));

            await vesting.claim(beneficiary, { from: beneficiary });

            claimable = await vesting.calculateClaimable.call(beneficiary);
            claimable[0].should.bignumber.equal(new BN(0));
            claimable[1].should.bignumber.equal(new BN(0));
        });

        it("cannot claim more than the allocated amount of bitcoin", async () => {
            await addVestingSchedule();

            // Claim well after vesting period has ended.
            await increaseTime(month * duration * 10);

            const claimable = await vesting.calculateClaimable.call(beneficiary);
            claimable[0].should.bignumber.equal(new BN(duration));
            claimable[1].should.bignumber.equal(amountAfterFee);
        });
    });
});
