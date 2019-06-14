import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecrecover, ecsign, pubToAddress } from "ethereumjs-util";

import { BTCShifterInstance, zBTCInstance } from "../types/truffle-contracts";
import { NULL } from "./helper/testUtils";

const BTCShifter = artifacts.require("BTCShifter");
const zBTC = artifacts.require("zBTC");

contract("Shifter", (accounts) => {
    let btcShifter: BTCShifterInstance;
    let zbtc: zBTCInstance;

    // We generate a new account so that we have access to its private key for
    // `ecsign`. Web3's sign functions all prefix the message being signed.
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

        await zbtc.transferOwnership(btcShifter.address);
        await btcShifter.claimTokenOwnership();
    });

    describe("can mint and burn", () => {
        const value = new BN(200000);
        const valueAfterFee = new BN(199800);

        it("can mint tokens with an unused hash, valid signature and commitment", async () => {
            const nonce = `0x${randomBytes(32).toString("hex")}`;
            const commitment = `0x${randomBytes(32).toString("hex")}`;

            const hash = await btcShifter.sigHash(accounts[2], value.toNumber(), nonce, commitment);
            const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

            pubToAddress(ecrecover(Buffer.from(hash.slice(2), "hex"), sig.v, sig.r, sig.s)).toString("hex")
                .should.equal(mintAuthority.address.slice(2).toLowerCase());

            var sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;

            await btcShifter.shiftIn(accounts[2], value.toNumber(), nonce, commitment, sigString);

            (await zbtc.balanceOf(accounts[2])).should.bignumber.equal(valueAfterFee);
        });

        it("can burn tokens", async () => {
            const btcAddress = `0x${randomBytes(35).toString("hex")}`;
            await btcShifter.shiftOut(btcAddress, valueAfterFee.toNumber(), { from: accounts[2] });
        })
    });

    describe("upgrading", () => {
        it("can upgrade the shifter", async () => {
            const newShifter = await BTCShifter.new(
                NULL,
                zbtc.address,
                feeRecipient,
                mintAuthority.address,
                feeInBips,
            );

            // Fund and unlock the mintAuthority
            await web3.eth.sendTransaction({ to: mintAuthority.address, from: accounts[0], value: web3.utils.toWei("1") });
            await web3.eth.personal.importRawKey(mintAuthority.privateKey, "");
            await web3.eth.personal.unlockAccount(mintAuthority.address, "", 600);

            await btcShifter.upgradeShifter(newShifter.address, { from: mintAuthority.address });
        });
    });
});
