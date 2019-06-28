import BN from "bn.js";
import { ecrecover, ecsign, pubToAddress } from "ethereumjs-util";
import { keccak256 } from "web3-utils";

import {
    BTCShifterInstance, ShifterInstance, ShifterRegistryInstance, zBTCInstance,
} from "../types/truffle-contracts";
import { log } from "./helper/logs";
import { ETHEREUM_TOKEN_ADDRESS, NULL, Ox, randomAddress, randomBytes } from "./helper/testUtils";

const ShifterRegistry = artifacts.require("ShifterRegistry");
const BTCShifter = artifacts.require("BTCShifter");
const zBTC = artifacts.require("zBTC");

contract("Shifter", ([owner, feeRecipient, user, malicious]) => {
    let btcShifter: BTCShifterInstance;
    let zbtc: zBTCInstance;

    // We generate a new account so that we have access to its private key for
    // `ecsign`. Web3's sign functions all prefix the message being signed.
    let mintAuthority;
    let privKey;

    const feeInBips = new BN(10);

    before(async () => {
        zbtc = await zBTC.new();
        mintAuthority = web3.eth.accounts.create();
        privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex")

        btcShifter = await BTCShifter.new(
            zbtc.address,
            feeRecipient,
            mintAuthority.address,
            feeInBips,
        );

        await zbtc.transferOwnership(btcShifter.address);
        await btcShifter.claimTokenOwnership();
    });

    const removeFee = (value: number | BN, bips: number | BN) => new BN(value).sub(new BN(value).mul(new BN(bips)).div(new BN(10000)));

    const mintTest = async (shifter: ShifterInstance, value: number | BN, shiftID = undefined) => {
        const nHash = randomBytes(32);
        const pHash = randomBytes(32);

        const hash = await shifter.hashForSignature(pHash, value, user, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

        pubToAddress(ecrecover(Buffer.from(hash.slice(2), "hex"), sig.v, sig.r, sig.s)).toString("hex")
            .should.equal(mintAuthority.address.slice(2).toLowerCase());

        const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

        const hashForSignature = await shifter.hashForSignature(pHash, value, user, nHash);
        (await shifter.verifySignature(hashForSignature, sigString))
            .should.be.true;

        const balanceBefore = new BN((await zbtc.balanceOf(user)).toString());
        const _shiftID = await shifter.nextShiftID();
        (await shifter.shiftIn(pHash, value, nHash, sigString, { from: user }) as any)
            .should.emit.logs([
                log("LogShiftIn", { _to: user, _amount: removeFee(value, 10), _shiftID: shiftID !== undefined ? shiftID : _shiftID }),
            ]);
        (await zbtc.balanceOf(user)).should.bignumber.equal(balanceBefore.add(removeFee(value, 10)));

        return [pHash, nHash];
    }

    const burnTest = async (shifter: ShifterInstance, value: number | BN, btcAddress?: string, shiftID = undefined) => {
        // Note: we don't use `||` because we want to pass in `""`
        btcAddress = btcAddress !== undefined ? btcAddress : randomBytes(35);

        const balanceBefore = new BN((await zbtc.balanceOf(user)).toString());
        const _shiftID = await shifter.nextShiftID();
        (await shifter.shiftOut(btcAddress, value, { from: user }) as any)
            .should.emit.logs([
                log("LogShiftOut", { _to: btcAddress, _amount: removeFee(value, 10), _shiftID: shiftID !== undefined ? shiftID : _shiftID, _indexedTo: keccak256(btcAddress) }),
            ]);
        (await zbtc.balanceOf(user)).should.bignumber.equal(balanceBefore.sub(new BN(value)));
    }

    describe("can mint and burn", () => {
        const value = new BN(20000);
        it("can mint tokens with an unused hash, valid signature and pHash", async () => mintTest(btcShifter, value));
        it("can burn tokens", async () => burnTest(btcShifter, removeFee(value, 10)));
        it("won't mint for the same nHash and pHash twice", async () => {
            const [pHash, nHash] = await mintTest(btcShifter, value);

            const hash = await btcShifter.hashForSignature(pHash, value.toNumber(), user, nHash);
            const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
            const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

            await btcShifter.shiftIn(pHash, value.toNumber(), nHash, sigString, { from: user })
                .should.be.rejectedWith(/nonce hash already spent/);
        });

        it("can mint for the same pHash with a different nHash", async () => {
            const [pHash, _] = await mintTest(btcShifter, value);

            const nHash = randomBytes(32);

            const hash = await btcShifter.hashForSignature(pHash, value.toNumber(), user, nHash);
            const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
            const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

            const balanceBefore = new BN((await zbtc.balanceOf(user)).toString());
            await btcShifter.shiftIn(pHash, value.toNumber(), nHash, sigString, { from: user });
            (await zbtc.balanceOf(user)).should.bignumber.equal(balanceBefore.add(removeFee(value, 10)));

            await burnTest(btcShifter, removeFee(value, 10));
        });

        it("won't mint with an invalid signature", async () => {
            const nHash1 = randomBytes(32);
            const nHash2 = randomBytes(32);
            const pHash = randomBytes(32);

            const hash = await btcShifter.hashForSignature(pHash, value.toNumber(), user, nHash1);
            const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

            const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

            await btcShifter.shiftIn(pHash, value.toNumber(), nHash2, sigString, { from: user })
                .should.be.rejectedWith(/invalid signature/);
        });

        it("can't burn to empty address", async () => {
            await burnTest(btcShifter, removeFee(value, 10), new Buffer([]) as any as string)
                .should.be.rejectedWith(/to address is empty/);
        });

        it("won't mint for a signature's complement", async () => {
            // If (r,s,v) is a valid ECDSA signature, then so is (r, -s % n, 1-v)
            // This means that a second signature for a message can be generated
            // without access to the private key. This test checks that the
            // Shifter contract won't accept two complementary signatures and
            // mint twice. See "Signature Malleability" at
            // https://yondon.blog/2019/01/01/how-not-to-use-ecdsa/

            const nHash = randomBytes(32);
            const pHash = randomBytes(32);

            const hash = await btcShifter.hashForSignature(pHash, value.toNumber(), user, nHash);

            let sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

            // Invalid signature
            const altSig = {
                ...sig,
                s: new BN("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", "hex").sub(new BN(sig.s)).toArrayLike(Buffer, "be", 32),
                v: sig.v === 27 ? 28 : 27,
            };
            const altSigString = Ox(`${altSig.r.toString("hex")}${altSig.s.toString("hex")}${(altSig.v).toString(16)}`);
            await btcShifter.shiftIn(pHash, value.toNumber(), nHash, altSigString, { from: user })
                .should.be.rejectedWith(/signature's s is in the wrong range/);

            // Valid signature
            const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);
            await btcShifter.shiftIn(pHash, value.toNumber(), nHash, sigString, { from: user });

            // Using the invalid signature after the valid one should throw
            // before checking the signature because the nonce hash has already
            // been used
            await btcShifter.shiftIn(pHash, value.toNumber(), nHash, altSigString, { from: user })
                .should.be.rejectedWith(/nonce hash already spent/);
        });
    });

    describe("updating fee recipient and mint authority", () => {
        it("can upgrade fee recipient", async () => {
            await (btcShifter.updateFeeRecipient(malicious, { from: malicious }))
                .should.be.rejectedWith(/caller is not the owner/);
            await (btcShifter.updateFeeRecipient(NULL, { from: owner }))
                .should.be.rejectedWith(/fee recipient cannot be 0x0/);
            await btcShifter.updateFeeRecipient(user, { from: owner });
            await btcShifter.updateFeeRecipient(feeRecipient, { from: owner });
        });

        it("can upgrade fee", async () => {
            const currentFee = await btcShifter.fee();
            await (btcShifter.updateFee(0, { from: malicious }))
                .should.be.rejectedWith(/caller is not the owner/);
            await btcShifter.updateFee(0, { from: owner });
            await btcShifter.updateFee(currentFee, { from: owner });
        });

        it("can upgrade mint authority", async () => {
            await (btcShifter.updateMintAuthority(malicious, { from: malicious }))
                .should.be.rejectedWith(/caller is not the owner/);
            await btcShifter.updateMintAuthority(user, { from: owner });
            await btcShifter.updateMintAuthority(mintAuthority.address, { from: owner });
        });
    });

    describe("shifter registry", () => {
        let registry: ShifterRegistryInstance;

        before(async () => {
            registry = await ShifterRegistry.new();
        });

        it("can register shifters", async () => {
            await registry.setShifter(zbtc.address, btcShifter.address);
            await registry.setShifter(zbtc.address, btcShifter.address)
                .should.be.rejectedWith(/shifter already registered/);
            await registry.setShifter(zbtc.address, NULL)
                .should.be.rejectedWith(/token already registered/);
        });

        it("can retrieve shifters", async () => {
            { // Try to register token with an existing symbol
                const altZbtc = await zBTC.new()
                await registry.setShifter(altZbtc.address, NULL)
                    .should.be.rejectedWith(/symbol already registered/);
            }

            (await registry.getShifterByToken(zbtc.address))
                .should.equal(btcShifter.address);

            (await registry.getShifterBySymbol("zBTC"))
                .should.equal(btcShifter.address);

            (await registry.getTokenBySymbol("zBTC"))
                .should.equal(zbtc.address);

            { // The first 10 shifters starting from NULL
                const shifters = await registry.getShifters(NULL, 10);
                shifters[0].should.equal(btcShifter.address);
                shifters[1].should.equal(NULL);
                shifters.length.should.equal(10);

                const shiftedTokens = await registry.getShiftedTokens(NULL, 10);
                shiftedTokens[0].should.equal(zbtc.address);
                shiftedTokens[1].should.equal(NULL);
                shiftedTokens.length.should.equal(10);
            }

            { // Get all the shifters starting from NULL
                const shifters = await registry.getShifters(NULL, 0);
                shifters[0].should.equal(btcShifter.address);
                shifters.length.should.equal(1);

                const shiftedTokens = await registry.getShiftedTokens(NULL, 0);
                shiftedTokens[0].should.equal(zbtc.address);
                shiftedTokens.length.should.equal(1);
            }

            { // Starting from first entry
                const shifters = await registry.getShifters(btcShifter.address, 10);
                shifters[0].should.equal(btcShifter.address);
                shifters[1].should.equal(NULL);
                shifters.length.should.equal(10);

                const shiftedTokens = await registry.getShiftedTokens(zbtc.address, 10);
                shiftedTokens[0].should.equal(zbtc.address);
                shiftedTokens[1].should.equal(NULL);
                shiftedTokens.length.should.equal(10);
            }

            { // Get all the shifters starting from first entry
                const shifters = await registry.getShifters(btcShifter.address, 0);
                shifters[0].should.equal(btcShifter.address);
                shifters.length.should.equal(1);

                const shiftedTokens = await registry.getShiftedTokens(zbtc.address, 0);
                shiftedTokens[0].should.equal(zbtc.address);
                shiftedTokens.length.should.equal(1);
            }
        });

        it("can update shifter for a token", async () => {
            (await registry.getShifterByToken(zbtc.address)).should.equal(btcShifter.address);

            const newBtcShifter = await BTCShifter.new(
                zbtc.address,
                feeRecipient,
                mintAuthority.address,
                feeInBips,
            );

            await registry.updateShifter(zbtc.address, newBtcShifter.address);

            (await registry.getShifterByToken(zbtc.address)).should.equal(newBtcShifter.address);
        });

        it("can't update shifter for an unregistered token", async () => {
            await registry.updateShifter(ETHEREUM_TOKEN_ADDRESS, randomAddress())
                .should.be.rejectedWith(/token not registered/);
        });

        it("can deregister shifters", async () => {
            await registry.removeShifter("zBTC");

            await registry.removeShifter("zBTC")
                .should.be.rejectedWith(/symbol not registered/);
        });
    });
});
