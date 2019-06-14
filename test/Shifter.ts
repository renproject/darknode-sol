import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecrecover, ecsign, pubToAddress } from "ethereumjs-util";

import { BTCShifterInstance, ShifterInstance, zBTCInstance } from "../types/truffle-contracts";
import { increaseTime, NULL } from "./helper/testUtils";

const BTCShifter = artifacts.require("BTCShifter");
const zBTC = artifacts.require("zBTC");

contract("Shifter", ([defaultAcc, feeRecipient, user, malicious]) => {
    let btcShifter: BTCShifterInstance;
    let zbtc: zBTCInstance;

    // We generate a new account so that we have access to its private key for
    // `ecsign`. Web3's sign functions all prefix the message being signed.
    const mintAuthority = web3.eth.accounts.create();
    const privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex");

    const feeInBips = new BN(10);

    before(async () => {
        zbtc = await zBTC.new();

        btcShifter = await BTCShifter.new(
            NULL,
            zbtc.address,
            feeRecipient,
            mintAuthority.address,
            feeInBips,
        );

        await zbtc.transferOwnership(btcShifter.address);
        await btcShifter.claimTokenOwnership();
    });

    const removeFee = (value, bips) => value.sub(value.mul(new BN(bips)).div(new BN(10000)))

    const mintTest = async (shifter: ShifterInstance, value: BN) => {
        const nonce = `0x${randomBytes(32).toString("hex")}`;
        const commitment = `0x${randomBytes(32).toString("hex")}`;

        const hash = await shifter.sigHash(user, value.toNumber(), nonce, commitment);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

        pubToAddress(ecrecover(Buffer.from(hash.slice(2), "hex"), sig.v, sig.r, sig.s)).toString("hex")
            .should.equal(mintAuthority.address.slice(2).toLowerCase());

        const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;

        (await shifter.verifySig(user, value.toNumber(), nonce, commitment, sigString))
            .should.be.true;

        const balanceBefore = new BN((await zbtc.balanceOf(user)).toString());
        await shifter.shiftIn(user, value.toNumber(), nonce, commitment, sigString);
        (await zbtc.balanceOf(user)).should.bignumber.equal(balanceBefore.add(removeFee(value, 10)));

        return [commitment, nonce];
    }

    const burnTest = async (shifter: ShifterInstance, value: BN) => {
        const btcAddress = `0x${randomBytes(35).toString("hex")}`;
        await shifter.shiftOut(btcAddress, removeFee(value, 10).toNumber(), { from: user });
    }

    describe("can mint and burn", () => {
        const value = new BN(200000);
        it("can mint tokens with an unused hash, valid signature and commitment", async () => mintTest(btcShifter, value));
        it("can burn tokens", async () => burnTest(btcShifter, value));
        it("won't mint for the same nonce and commitment twice", async () => {
            const [commitment, nonce] = await mintTest(btcShifter, value);

            const hash = await btcShifter.sigHash(user, value.toNumber(), nonce, commitment);
            const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
            const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;

            await (btcShifter.shiftIn(user, value.toNumber(), nonce, commitment, sigString))
                .should.be.rejectedWith(/commitment already spent/);
        });

        it("can mint for the same commitment with a different nonce", async () => {
            const [commitment, _] = await mintTest(btcShifter, value);

            const nonce = `0x${randomBytes(32).toString("hex")}`;

            const hash = await btcShifter.sigHash(user, value.toNumber(), nonce, commitment);
            const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
            const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;

            const balanceBefore = new BN((await zbtc.balanceOf(user)).toString());
            await btcShifter.shiftIn(user, value.toNumber(), nonce, commitment, sigString);
            (await zbtc.balanceOf(user)).should.bignumber.equal(balanceBefore.add(removeFee(value, 10)));

            await burnTest(btcShifter, value);
        });

        it("won't mind with an invalid signature", async () => {
            const nonce1 = `0x${randomBytes(32).toString("hex")}`;
            const nonce2 = `0x${randomBytes(32).toString("hex")}`;
            const commitment = `0x${randomBytes(32).toString("hex")}`;

            const hash = await btcShifter.sigHash(user, value.toNumber(), nonce1, commitment);
            const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

            const sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;

            await (btcShifter.shiftIn(user, value.toNumber(), nonce2, commitment, sigString))
                .should.be.rejectedWith(/invalid signature/);
        });

        it("can't call forwardShiftOut", async () => {
            const btcAddress = `0x${randomBytes(35).toString("hex")}`;
            await (btcShifter.forwardShiftOut(user, btcAddress, removeFee(value, 10).toNumber(), { from: malicious }))
                .should.be.rejectedWith(/must be previous Shifter contract/);
        })
    });

    describe("upgrading", () => {
        let newShifter;

        // Reset the upgrade
        after(async () => {
            // Trying to reset upgrade in btcShifter without owning the token
            await btcShifter.upgradeShifter(NULL, { from: mintAuthority.address });
            await increaseTime(2 * 60 * 60 * 24);
            await (btcShifter.upgradeShifter(NULL, { from: mintAuthority.address }))
                .should.be.rejectedWith(/must be owner of token to reset upgrade/);

            // Upgrade newShifter to point to btcShifter
            await newShifter.upgradeShifter(btcShifter.address, { from: mintAuthority.address });
            await increaseTime(2 * 60 * 60 * 24);
            await newShifter.upgradeShifter(btcShifter.address, { from: mintAuthority.address });

            // Reset the upgrade in btcShifter
            await btcShifter.upgradeShifter(NULL, { from: mintAuthority.address });
            await increaseTime(2 * 60 * 60 * 24);
            await btcShifter.upgradeShifter(NULL, { from: mintAuthority.address });
        });

        it("can upgrade the shifter", async () => {
            newShifter = await BTCShifter.new(
                btcShifter.address,
                zbtc.address,
                feeRecipient,
                mintAuthority.address,
                feeInBips,
            );

            // Fund and unlock the mintAuthority
            await web3.eth.sendTransaction({ to: mintAuthority.address, from: defaultAcc, value: web3.utils.toWei("1") });
            await web3.eth.personal.importRawKey(mintAuthority.privateKey, "");
            await web3.eth.personal.unlockAccount(mintAuthority.address, "", 600);

            await (btcShifter.upgradeShifter(newShifter.address, { from: malicious }))
                .should.be.rejectedWith(/not authorized/);

            await btcShifter.upgradeShifter(newShifter.address, { from: mintAuthority.address });

            // Too soon
            await btcShifter.upgradeShifter(newShifter.address, { from: mintAuthority.address });
            (await zbtc.owner()).should.equal(btcShifter.address);

            // Sleep for two days
            await increaseTime(2 * 60 * 60 * 24);

            // Not soo soon
            await btcShifter.upgradeShifter(newShifter.address, { from: mintAuthority.address });
            (await zbtc.owner()).should.equal(newShifter.address);
        });

        describe("can mint and burn using old shifter", () => {
            const value = new BN(200000);
            it("can mint tokens", async () => mintTest(btcShifter, value));
            it("can burn tokens", async () => burnTest(btcShifter, value))
        });

        describe("can mint and burn using new shifter", () => {
            const value = new BN(200000);
            it("can mint tokens", async () => mintTest(newShifter, value));
            it("can burn tokens", async () => burnTest(newShifter, value))
        });

        it("can't upgrade to an invalid shifter", async () => {
            await newShifter.upgradeShifter(malicious, { from: mintAuthority.address });

            // Sleep for two days
            await increaseTime(2 * 60 * 60 * 24);

            // Not soo soon
            await (newShifter.upgradeShifter(malicious, { from: mintAuthority.address }))
                .should.be.rejectedWith(/revert/);
        });
    });
});
