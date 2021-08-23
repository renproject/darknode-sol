// tslint:disable: variable-name

import BigNumber from "bignumber.js";
import BN from "bn.js";
import { ecrecover, ecsign, pubToAddress } from "ethereumjs-util";
import { Account } from "web3-eth-accounts";
import { keccak256 } from "web3-utils";

import {
    GatewayLogicV1Instance,
    GatewayRegistryInstance,
    RenERC20LogicV1Instance
} from "../types/truffle-contracts";
import { log } from "./helper/logs";
import {
    deployProxy,
    ETHEREUM,
    NULL,
    Ox,
    randomAddress,
    randomBytes
} from "./helper/testUtils";

const ForceSend = artifacts.require("ForceSend");
const RenToken = artifacts.require("RenToken");
const Claimer = artifacts.require("Claimer");
const GatewayRegistry = artifacts.require("GatewayRegistry");
const BTCGateway = artifacts.require("BTCGateway");
const RenBTC = artifacts.require("RenBTC");
const RenERC20LogicV1 = artifacts.require("RenERC20LogicV1");
const GatewayLogicV1 = artifacts.require("GatewayLogicV1");

contract(
    "Gateway",
    ([owner, feeRecipient, user, malicious, proxyGovernanceAddress]) => {
        let btcGateway: GatewayLogicV1Instance;
        let renbtc: RenERC20LogicV1Instance;

        // We generate a new account so that we have access to its private key for
        // `ecsign`. Web3's sign functions all prefix the message being signed.
        let mintAuthority: Account;
        let privKey: Buffer;

        const mintFees = new BN(10);
        const burnFees = new BN(10);

        describe("ERC20 with rate", () => {
            it("rate must be initialized", async () => {
                const token = await RenERC20LogicV1.new({ from: owner });

                await token.exchangeRateCurrent
                    .call()
                    .should.be.rejectedWith(
                        /ERC20WithRate: rate has not been initialized/
                    );
            });

            it("can set rate", async () => {
                const rate = "1000000000000000000";
                const token = await deployProxy<RenERC20LogicV1Instance>(
                    web3,
                    RenBTC,
                    RenERC20LogicV1,
                    proxyGovernanceAddress,
                    [
                        { type: "uint256", value: await web3.eth.net.getId() },
                        { type: "address", value: owner },
                        { type: "uint256", value: rate },
                        { type: "string", value: "1" },
                        { type: "string", value: "renBTC" },
                        { type: "string", value: "renBTC" },
                        { type: "uint8", value: 8 }
                    ],
                    { from: owner }
                );
                await token
                    .setExchangeRate(0, { from: owner })
                    .should.be.rejectedWith(
                        /ERC20WithRate: rate must be greater than zero/
                    );

                await token.setExchangeRate(new BN(rate).add(new BN(1)), {
                    from: owner
                });

                (await token.exchangeRateCurrent.call()).should.bignumber.equal(
                    new BN(rate).add(new BN(1))
                );

                await token.setExchangeRate(rate);

                (await token.exchangeRateCurrent.call()).should.bignumber.equal(
                    rate
                );
            });
        });

        for (const rate of [
            "2000000000000000000",
            "1000000000000000000",
            "500000000000000000"
        ]) {
            // for (const rate of ["2000000000000000000", "1000000000000000000", "500000000000000000", "1111111111111111111"]) {
            // for (const rate of ["1111111111111111111"]) {

            describe(`Gateway with rate ${new BigNumber(rate)
                .div(1e18)
                .toFixed()}`, () => {
                before(async () => {
                    renbtc = await deployProxy<RenERC20LogicV1Instance>(
                        web3,
                        RenBTC,
                        RenERC20LogicV1,
                        proxyGovernanceAddress,
                        [
                            {
                                type: "uint256",
                                value: await web3.eth.net.getId()
                            },
                            { type: "address", value: owner },
                            { type: "uint256", value: rate },
                            { type: "string", value: "1" },
                            { type: "string", value: "renBTC" },
                            { type: "string", value: "renBTC" },
                            { type: "uint8", value: 8 }
                        ],
                        { from: owner }
                    );
                    mintAuthority = web3.eth.accounts.create();
                    privKey = Buffer.from(
                        mintAuthority.privateKey.slice(2),
                        "hex"
                    );

                    btcGateway = await deployProxy<GatewayLogicV1Instance>(
                        web3,
                        BTCGateway,
                        GatewayLogicV1,
                        proxyGovernanceAddress,
                        [
                            { type: "address", value: renbtc.address },
                            { type: "address", value: feeRecipient },
                            { type: "address", value: mintAuthority.address },
                            { type: "uint16", value: mintFees.toString() },
                            { type: "uint16", value: burnFees.toString() },
                            { type: "uint256", value: 10000 }
                        ],
                        { from: owner }
                    );

                    await renbtc.transferOwnership(btcGateway.address);
                    await btcGateway.claimTokenOwnership();
                });

                const getFeeScaled = async (
                    token: RenERC20LogicV1Instance,
                    amountUnderlying: number | BN,
                    bips: number | BN
                ) => {
                    const amountScaled = new BN(
                        await token.fromUnderlying.call(amountUnderlying)
                    );
                    const amountFee = amountScaled
                        .mul(new BN(bips))
                        .div(new BN(10000));
                    return amountFee;
                };

                const removeMintFee = async (
                    token: RenERC20LogicV1Instance,
                    amountUnderlying: number | BN,
                    bips: number | BN
                ) => {
                    const amount = new BigNumber(
                        (
                            await token.fromUnderlying.call(amountUnderlying)
                        ).toString()
                    );
                    const amountFee = amount
                        .times(new BigNumber(bips.toString()))
                        .div(new BigNumber(10000))
                        .decimalPlaces(0, BigNumber.ROUND_DOWN);
                    const amountAfterFee = amount
                        .minus(amountFee)
                        .decimalPlaces(0, BigNumber.ROUND_DOWN);
                    const amountAfterFeeUnderlying = await token.toUnderlying.call(
                        amountAfterFee.toFixed(0, BigNumber.ROUND_DOWN)
                    );
                    const amountAfterFeeRepresentable = await token.fromUnderlying.call(
                        amountAfterFeeUnderlying
                    );
                    // The following may slightly vary from amountAfterFeeUnderlying.
                    const amountAfterFeeRepresentableUnderlying = new BigNumber(
                        (
                            await token.toUnderlying.call(
                                amountAfterFeeRepresentable
                            )
                        ).toString()
                    ).decimalPlaces(0, BigNumber.ROUND_DOWN);

                    const result = new BN(
                        amountAfterFeeRepresentableUnderlying.toFixed(
                            0,
                            BigNumber.ROUND_DOWN
                        )
                    );

                    return result;
                };

                const removeBurnFee = async (
                    token: RenERC20LogicV1Instance,
                    amountUnderlying: number | BN,
                    bips: number | BN
                ) => {
                    const amount_scaled = new BigNumber(
                        (
                            await token.fromUnderlying.call(amountUnderlying)
                        ).toString()
                    );
                    const amountFee_scaled = amount_scaled
                        .times(new BigNumber(bips.toString()))
                        .div(new BigNumber(10000))
                        .decimalPlaces(0, BigNumber.ROUND_DOWN);
                    const amountAfterFee_scaled = amount_scaled
                        .minus(amountFee_scaled)
                        .decimalPlaces(0, BigNumber.ROUND_DOWN);
                    const amountAfterFee = await token.toUnderlying.call(
                        amountAfterFee_scaled.toFixed(0, BigNumber.ROUND_DOWN)
                    );

                    return new BN(amountAfterFee.toString());
                };

                const mintTest = async (
                    gateway: GatewayLogicV1Instance,
                    value: number | BN,
                    n?: string
                ): Promise<[string, string, BN]> => {
                    const nHash = randomBytes(32);
                    const pHash = randomBytes(32);

                    const hash = await gateway.hashForSignature.call(
                        pHash,
                        value,
                        user,
                        nHash
                    );
                    const sig = ecsign(
                        Buffer.from(hash.slice(2), "hex"),
                        privKey
                    );

                    pubToAddress(
                        ecrecover(
                            Buffer.from(hash.slice(2), "hex"),
                            sig.v,
                            sig.r,
                            sig.s
                        )
                    )
                        .toString("hex")
                        .should.equal(
                            mintAuthority.address.slice(2).toLowerCase()
                        );

                    const sigString = Ox(
                        `${sig.r.toString("hex")}${sig.s.toString(
                            "hex"
                        )}${sig.v.toString(16)}`
                    );

                    const hashForSignature = await gateway.hashForSignature.call(
                        pHash,
                        value,
                        user,
                        nHash
                    );
                    (
                        await gateway.verifySignature.call(
                            hashForSignature,
                            sigString
                        )
                    ).should.be.true;

                    const balanceBefore = new BN(
                        (await renbtc.balanceOfUnderlying.call(user)).toString()
                    );
                    const _n = await gateway.nextN.call();
                    const valueMinted = await removeMintFee(
                        renbtc,
                        value,
                        mintFees
                    );
                    ((await gateway.mint(pHash, value, nHash, sigString, {
                        from: user
                    })) as any).should.emit.logs([
                        log("LogMint", {
                            _to: user,
                            _amount: valueMinted,
                            _n: n !== undefined ? n : _n
                        })
                    ]);
                    // (await renbtc.balanceOfUnderlying.call(user)).should.bignumber.equal(balanceBefore.add(valueMinted));

                    (
                        await renbtc.balanceOfUnderlying.call(user)
                    ).should.bignumber.lte(
                        balanceBefore
                            .add(await removeMintFee(renbtc, value, mintFees))
                            .add(new BN(1))
                    );
                    (
                        await renbtc.balanceOfUnderlying.call(user)
                    ).should.bignumber.gte(
                        balanceBefore
                            .add(await removeMintFee(renbtc, value, mintFees))
                            .sub(new BN(1))
                    );

                    return [pHash, nHash, valueMinted];
                };

                const burnTest = async (
                    gateway: GatewayLogicV1Instance,
                    value: number | BN,
                    btcAddress?: string,
                    n?: string
                ) => {
                    // Note: we don't use `||` because we want to pass in `""`
                    btcAddress =
                        btcAddress !== undefined ? btcAddress : randomBytes(35);

                    const balanceBefore = new BN(
                        (await renbtc.balanceOf.call(user)).toString()
                    );
                    const _n = await gateway.nextN.call();

                    const tokenAddress = await gateway.token.call();
                    const token = await RenERC20LogicV1.at(tokenAddress);

                    const value_scaled = new BN(
                        (await token.fromUnderlying.call(value)).toString()
                    );
                    const amountAfterFees = await removeBurnFee(
                        token,
                        new BN(
                            await (
                                await token.toUnderlying.call(value_scaled)
                            ).toString()
                        ),
                        burnFees
                    );
                    // const fee = await getFeeScaled(token, value, burnFees);
                    // const subtractedValueScaled = new BN(await token.fromUnderlying.call(amountAfterFees)).add(fee);

                    const x = (await gateway.burn(btcAddress, value_scaled, {
                        from: user
                    })) as any;
                    x.should.emit.logs([
                        log("LogBurn", {
                            _to: btcAddress,
                            _amount: amountAfterFees,
                            _n: n !== undefined ? n : _n,
                            _indexedTo: keccak256(btcAddress)
                        })
                    ]);

                    // Should be at most 1 less than the expected value. It should not be less than the expected value.
                    (await renbtc.balanceOf.call(user)).should.bignumber.lte(
                        balanceBefore.sub(value_scaled).add(new BN(1))
                    );
                    (await renbtc.balanceOf.call(user)).should.bignumber.gte(
                        balanceBefore.sub(value_scaled)
                    );
                };

                describe("can mint and burn", () => {
                    const value = new BN(
                        Math.floor(Math.random() * 20000) + 40000
                    );
                    it("can mint tokens with an unused hash, valid signature and pHash", async () =>
                        mintTest(btcGateway, value));
                    it("can burn tokens", async () =>
                        burnTest(btcGateway, 24975));
                    it("won't mint for the same nHash and pHash twice", async () => {
                        const [pHash, nHash] = await mintTest(
                            btcGateway,
                            value
                        );

                        const hash = await btcGateway.hashForSignature.call(
                            pHash,
                            value.toNumber(),
                            user,
                            nHash
                        );
                        const sig = ecsign(
                            Buffer.from(hash.slice(2), "hex"),
                            privKey
                        );
                        const sigString = Ox(
                            `${sig.r.toString("hex")}${sig.s.toString(
                                "hex"
                            )}${sig.v.toString(16)}`
                        );

                        await btcGateway
                            .mint(pHash, value.toNumber(), nHash, sigString, {
                                from: user
                            })
                            .should.be.rejectedWith(
                                /Gateway: nonce hash already spent/
                            );
                    });

                    it("can mint for the same pHash with a different nHash", async () => {
                        const [pHash, _] = await mintTest(btcGateway, value);

                        const nHash = randomBytes(32);

                        const hash = await btcGateway.hashForSignature.call(
                            pHash,
                            value.toNumber(),
                            user,
                            nHash
                        );
                        const sig = ecsign(
                            Buffer.from(hash.slice(2), "hex"),
                            privKey
                        );
                        const sigString = Ox(
                            `${sig.r.toString("hex")}${sig.s.toString(
                                "hex"
                            )}${sig.v.toString(16)}`
                        );

                        await btcGateway.mint(
                            pHash,
                            value.toNumber(),
                            nHash,
                            sigString,
                            { from: user }
                        );

                        await burnTest(
                            btcGateway,
                            await removeMintFee(renbtc, value, mintFees)
                        );
                    });

                    it("won't mint with an invalid signature", async () => {
                        const nHash1 = randomBytes(32);
                        const nHash2 = randomBytes(32);
                        const pHash = randomBytes(32);

                        const hash = await btcGateway.hashForSignature.call(
                            pHash,
                            value.toNumber(),
                            user,
                            nHash1
                        );
                        const sig = ecsign(
                            Buffer.from(hash.slice(2), "hex"),
                            privKey
                        );

                        const sigString = Ox(
                            `${sig.r.toString("hex")}${sig.s.toString(
                                "hex"
                            )}${sig.v.toString(16)}`
                        );

                        await btcGateway
                            .mint(pHash, value.toNumber(), nHash2, sigString, {
                                from: user
                            })
                            .should.be.rejectedWith(
                                /Gateway: invalid signature/
                            );
                    });

                    it("can't burn to empty address", async () => {
                        await burnTest(
                            btcGateway,
                            await removeMintFee(renbtc, value, mintFees),
                            (new Buffer([]) as any) as string
                        ).should.be.rejectedWith(
                            /Gateway: to address is empty/
                        );
                    });

                    it("can't burn less than minimum burn amount", async () => {
                        await burnTest(btcGateway, 5000).should.be.rejectedWith(
                            /Gateway: amount is less than the minimum burn amount/
                        );
                    });

                    it("won't mint for a signature's complement", async () => {
                        // If (r,s,v) is a valid ECDSA signature, then so is (r, -s % n, 1-v)
                        // This means that a second signature for a message can be generated
                        // without access to the private key. This test checks that the
                        // Gateway contract won't accept two complementary signatures and
                        // mint twice. See "Signature Malleability" at
                        // https://yondon.blog/2019/01/01/how-not-to-use-ecdsa/

                        const nHash = randomBytes(32);
                        const pHash = randomBytes(32);

                        const hash = await btcGateway.hashForSignature.call(
                            pHash,
                            value.toNumber(),
                            user,
                            nHash
                        );

                        const sig = ecsign(
                            Buffer.from(hash.slice(2), "hex"),
                            privKey
                        );

                        // Invalid signature
                        const altSig = {
                            ...sig,
                            s: new BN(
                                "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
                                "hex"
                            )
                                .sub(new BN(sig.s))
                                .toArrayLike(Buffer, "be", 32),
                            v: sig.v === 27 ? 28 : 27
                        };
                        const altSigString = Ox(
                            `${altSig.r.toString("hex")}${altSig.s.toString(
                                "hex"
                            )}${altSig.v.toString(16)}`
                        );
                        await btcGateway
                            .mint(
                                pHash,
                                value.toNumber(),
                                nHash,
                                altSigString,
                                { from: user }
                            )
                            .should.be.rejectedWith(
                                /ECDSA: signature.s is in the wrong range/
                            );

                        // Valid signature
                        const sigString = Ox(
                            `${sig.r.toString("hex")}${sig.s.toString(
                                "hex"
                            )}${sig.v.toString(16)}`
                        );
                        await btcGateway.mint(
                            pHash,
                            value.toNumber(),
                            nHash,
                            sigString,
                            { from: user }
                        );

                        // Using the invalid signature after the valid one should throw
                        // before checking the signature because the nonce hash has already
                        // been used
                        await btcGateway
                            .mint(
                                pHash,
                                value.toNumber(),
                                nHash,
                                altSigString,
                                { from: user }
                            )
                            .should.be.rejectedWith(
                                /Gateway: nonce hash already spent/
                            );
                    });
                });

                describe("updating fee recipient and mint authority", () => {
                    it("can upgrade fee recipient", async () => {
                        await btcGateway
                            .updateFeeRecipient(malicious, { from: malicious })
                            .should.be.rejectedWith(
                                /Ownable: caller is not the owner/
                            );
                        await btcGateway
                            .updateFeeRecipient(NULL, { from: owner })
                            .should.be.rejectedWith(
                                /Gateway: fee recipient cannot be 0x0/
                            );
                        await btcGateway.updateFeeRecipient(user, {
                            from: owner
                        });
                        await btcGateway.updateFeeRecipient(feeRecipient, {
                            from: owner
                        });
                    });

                    it("can upgrade mint fee", async () => {
                        const currentFee = await btcGateway.mintFee.call();
                        await btcGateway
                            .updateMintFee(0, { from: malicious })
                            .should.be.rejectedWith(
                                /Ownable: caller is not the owner/
                            );
                        await btcGateway.updateMintFee(0, { from: owner });
                        await btcGateway.updateMintFee(currentFee, {
                            from: owner
                        });
                    });

                    it("can upgrade burn fee", async () => {
                        const currentFee = await btcGateway.burnFee.call();
                        await btcGateway
                            .updateBurnFee(0, { from: malicious })
                            .should.be.rejectedWith(
                                /Ownable: caller is not the owner/
                            );
                        await btcGateway.updateBurnFee(0, { from: owner });
                        await btcGateway.updateBurnFee(currentFee, {
                            from: owner
                        });
                    });

                    it("can upgrade mint authority", async () => {
                        await btcGateway
                            .updateMintAuthority(malicious, { from: malicious })
                            .should.be.rejectedWith(
                                /Gateway: caller is not the owner or mint authority/
                            );
                        // Owner can update mint authority
                        await btcGateway.updateMintAuthority(user, {
                            from: owner
                        });
                        // Mint authority can update mint authority
                        await btcGateway.updateMintAuthority(user, {
                            from: user
                        });
                        await btcGateway.updateMintAuthority(
                            mintAuthority.address,
                            { from: owner }
                        );
                    });

                    it("cannot upgrade mint authority to zero address", async () => {
                        await btcGateway
                            .updateMintAuthority(NULL, { from: owner })
                            .should.be.rejectedWith(
                                /Gateway: mintAuthority cannot be set to address zero/
                            );
                    });

                    it("can upgrade min burn amount", async () => {
                        await btcGateway
                            .updateMinimumBurnAmount(malicious, {
                                from: malicious
                            })
                            .should.be.rejectedWith(
                                /Ownable: caller is not the owner/
                            );
                        await btcGateway.updateMinimumBurnAmount(8000, {
                            from: owner
                        });
                        await btcGateway.updateMinimumBurnAmount(10000, {
                            from: owner
                        });
                    });
                });

                describe("upgrading gateway", () => {
                    let newGateway: GatewayLogicV1Instance;

                    it("can upgrade the gateway", async () => {
                        newGateway = await deployProxy<GatewayLogicV1Instance>(
                            web3,
                            BTCGateway,
                            GatewayLogicV1,
                            proxyGovernanceAddress,
                            [
                                { type: "address", value: renbtc.address },
                                { type: "address", value: feeRecipient },
                                {
                                    type: "address",
                                    value: mintAuthority.address
                                },
                                { type: "uint16", value: mintFees.toString() },
                                { type: "uint16", value: burnFees.toString() },
                                { type: "uint256", value: 10000 }
                            ],
                            { from: owner }
                        );

                        // Fund and unlock the mintAuthority - not used currently but
                        // may be needed in the future.
                        /* await web3.eth.sendTransaction({ to: mintAuthority.address, from: owner, value: web3.utils.toWei("1") });
                         * await web3.eth.personal.importRawKey(mintAuthority.privateKey, "");
                         * await web3.eth.personal.unlockAccount(mintAuthority.address, "", 6000);
                         */

                        await btcGateway
                            .transferTokenOwnership(newGateway.address, {
                                from: malicious
                            })
                            .should.be.rejectedWith(
                                /Ownable: caller is not the owner/
                            );

                        await btcGateway.transferTokenOwnership(
                            newGateway.address,
                            { from: owner }
                        );
                        (await renbtc.owner.call()).should.equal(
                            newGateway.address
                        );
                    });

                    it("can mint and burn using new gateway", async () => {
                        const value = new BN(
                            Math.floor(Math.random() * 200000) + 10000
                        );
                        await mintTest(newGateway, value);
                        await burnTest(
                            newGateway,
                            await removeMintFee(renbtc, value, mintFees)
                        );
                    });

                    it("can't upgrade to an invalid gateway", async () => {
                        await newGateway
                            .transferTokenOwnership(malicious, { from: owner })
                            .should.be.rejectedWith(/revert/); // Tries to call ".claim" on non-contract address

                        await renbtc
                            .claimOwnership({ from: malicious })
                            .should.be.rejectedWith(
                                /Claimable: caller is not the pending owner/
                            );
                    });

                    it("can reset the upgrade", async () => {
                        // Trying to reset upgrade in btcGateway without owning the token
                        await btcGateway
                            .transferTokenOwnership(NULL, { from: owner })
                            .should.be.rejectedWith(
                                /Ownable: caller is not the owner/
                            );

                        // Upgrade newGateway to point to btcGateway
                        await newGateway.transferTokenOwnership(
                            btcGateway.address,
                            { from: owner }
                        );

                        (await renbtc.owner.call()).should.equal(
                            btcGateway.address
                        );
                    });
                });

                describe("recovering funds", () => {
                    it("should be able to withdraw funds that are mistakenly sent to a Gateway", async () => {
                        let renbtcValue = new BN(
                            Math.floor(Math.random() * 200000) + 10000
                        );
                        [, , renbtcValue] = await mintTest(
                            btcGateway,
                            renbtcValue
                        );
                        renbtcValue = new BN(
                            (
                                await renbtc.fromUnderlying.call(renbtcValue)
                            ).toString()
                        );

                        await renbtc.transfer(btcGateway.address, renbtcValue, {
                            from: user
                        });

                        const renAmount = 1000;
                        const ren = await RenToken.deployed();
                        await ren.transfer(btcGateway.address, renAmount);

                        // Only the owner can recover tokens
                        await btcGateway
                            .recoverTokens(ren.address, { from: malicious })
                            .should.be.rejectedWith(
                                /Ownable: caller is not the owner/
                            );

                        // Recover renBTC
                        const balanceBefore = new BN(
                            await renbtc.balanceOf.call(owner)
                        );
                        await btcGateway.recoverTokens(renbtc.address, {
                            from: owner
                        });
                        const balanceAfter = new BN(
                            await renbtc.balanceOf.call(owner)
                        );
                        balanceAfter
                            .sub(balanceBefore)
                            .should.bignumber.equal(renbtcValue);
                        await renbtc.transfer(user, renbtcValue);

                        // Recover REN
                        const initialRenBalance = new BN(
                            (await ren.balanceOf.call(owner)).toString()
                        );
                        await btcGateway.recoverTokens(ren.address, {
                            from: owner
                        });
                        const finalRenBalance = new BN(
                            (await ren.balanceOf.call(owner)).toString()
                        );
                        finalRenBalance
                            .sub(initialRenBalance)
                            .should.bignumber.equal(renAmount);

                        // Recover ETH
                        const forceSend = await ForceSend.new();
                        await forceSend.send(btcGateway.address, {
                            value: "1"
                        });
                        (
                            await web3.eth.getBalance(btcGateway.address)
                        ).should.bignumber.greaterThan(0);
                        await btcGateway.recoverTokens(NULL, { from: owner });
                        (
                            await web3.eth.getBalance(btcGateway.address)
                        ).should.bignumber.equal(0);

                        await burnTest(
                            btcGateway,
                            new BN(
                                (
                                    await renbtc.toUnderlying.call(balanceAfter)
                                ).toString()
                            )
                        );
                    });

                    it("should be able to withdraw funds that are mistakenly sent to a token", async () => {
                        // let renbtcValue = new BN(200000);
                        // await mintTest(btcGateway, renbtcValue);
                        // renbtcValue = await removeFee(renbtcValue, mintFees);
                        // await renbtc.transfer(renbtc.address, renbtcValue, { from: user });

                        const renAmount = 1000;
                        const ren = await RenToken.deployed();
                        await ren.transfer(renbtc.address, renAmount);

                        // Only the owner can recover tokens
                        await renbtc
                            .recoverTokens(ren.address, { from: malicious })
                            .should.be.rejectedWith(
                                /Ownable: caller is not the owner/
                            );

                        const claimer = await Claimer.new(renbtc.address);
                        await btcGateway.transferTokenOwnership(
                            claimer.address,
                            { from: owner }
                        );
                        await claimer.transferTokenOwnership(owner, {
                            from: owner
                        });
                        await renbtc.claimOwnership({ from: owner });

                        // Recover REN
                        const initialRenBalance = new BN(
                            (await ren.balanceOf.call(owner)).toString()
                        );
                        await renbtc.recoverTokens(ren.address, {
                            from: owner
                        });
                        const finalRenBalance = new BN(
                            (await ren.balanceOf.call(owner)).toString()
                        );
                        finalRenBalance
                            .sub(initialRenBalance)
                            .should.bignumber.equal(renAmount);

                        // Recover renBTC
                        // const balanceBefore = new BN(await renbtc.balanceOf.call(owner));
                        // await renbtc.recoverTokens(renbtc.address, { from: owner });
                        // const balanceAfter = new BN(await renbtc.balanceOf.call(owner));
                        // balanceAfter.sub(balanceBefore).should.bignumber.equal(renbtcValue);
                        // await renbtc.transfer(user, renbtcValue);

                        // Recover ETH
                        const forceSend = await ForceSend.new();
                        await forceSend.send(btcGateway.address, {
                            value: "1"
                        });
                        (
                            await web3.eth.getBalance(btcGateway.address)
                        ).should.bignumber.greaterThan(0);
                        await btcGateway.recoverTokens(NULL, { from: owner });
                        (
                            await web3.eth.getBalance(btcGateway.address)
                        ).should.bignumber.equal(0);

                        await renbtc.transferOwnership(btcGateway.address);
                        await btcGateway.claimTokenOwnership();

                        // await burnTest(btcGateway, renbtcValue);
                    });
                });

                describe("gateway registry", () => {
                    let registry: GatewayRegistryInstance;

                    before(async () => {
                        registry = await GatewayRegistry.new();
                    });

                    it("symbol validation", async () => {
                        (await registry.symbolIsValid.call("BTC")).should.be
                            .true;
                        (await registry.symbolIsValid.call("ZEC")).should.be
                            .true;
                        (await registry.symbolIsValid.call("BCH")).should.be
                            .true;

                        (await registry.symbolIsValid.call("zеc!")).should.be
                            .false;

                        (await registry.symbolIsValid.call("zec")).should.be
                            .true;
                        // Cyrillic letter "е".
                        (await registry.symbolIsValid.call("zеc")).should.be
                            .false;
                    });

                    it("can register gateways", async () => {
                        await registry.setGateway(
                            "BTC",
                            renbtc.address,
                            btcGateway.address
                        );
                        await registry
                            .setGateway(
                                "BTC",
                                renbtc.address,
                                btcGateway.address
                            )
                            .should.be.rejectedWith(
                                /GatewayRegistry: gateway already registered/
                            );
                        await registry
                            .setGateway("BTC", renbtc.address, NULL)
                            .should.be.rejectedWith(
                                /GatewayRegistry: token already registered/
                            );

                        await registry
                            .setGateway("BTC!", NULL, NULL)
                            .should.be.rejectedWith(
                                /GatewayRegistry: symbol must be alphanumeric/
                            );
                    });

                    it("can retrieve gateways", async () => {
                        {
                            // Try to register token with an existing symbol
                            const altRenBTC = await RenERC20LogicV1.new();
                            await altRenBTC.initialize(
                                await web3.eth.net.getId(),
                                owner,
                                "500000000000000000",
                                "1",
                                "renBTC",
                                "renBTC",
                                8
                            );
                            await registry
                                .setGateway("BTC", altRenBTC.address, NULL)
                                .should.be.rejectedWith(
                                    /GatewayRegistry: symbol already registered/
                                );
                        }

                        (
                            await registry.getGatewayByToken.call(
                                renbtc.address
                            )
                        ).should.equal(btcGateway.address);

                        (
                            await registry.getGatewayBySymbol.call("BTC")
                        ).should.equal(btcGateway.address);

                        (
                            await registry.getTokenBySymbol.call("BTC")
                        ).should.equal(renbtc.address);

                        {
                            // The first 10 gateways starting from NULL
                            const gateway = await registry.getGateways.call(
                                NULL,
                                10
                            );
                            gateway[0].should.equal(btcGateway.address);
                            gateway[1].should.equal(NULL);
                            gateway.length.should.equal(10);

                            const renTokens = await registry.getRenTokens.call(
                                NULL,
                                10
                            );
                            renTokens[0].should.equal(renbtc.address);
                            renTokens[1].should.equal(NULL);
                            renTokens.length.should.equal(10);
                        }

                        {
                            // Get all the gateways starting from NULL
                            const gateway = await registry.getGateways.call(
                                NULL,
                                0
                            );
                            gateway[0].should.equal(btcGateway.address);
                            gateway.length.should.equal(1);

                            const renTokens = await registry.getRenTokens.call(
                                NULL,
                                0
                            );
                            renTokens[0].should.equal(renbtc.address);
                            renTokens.length.should.equal(1);
                        }

                        {
                            // Starting from first entry
                            const gateway = await registry.getGateways.call(
                                btcGateway.address,
                                10
                            );
                            gateway[0].should.equal(btcGateway.address);
                            gateway[1].should.equal(NULL);
                            gateway.length.should.equal(10);

                            const renTokens = await registry.getRenTokens.call(
                                renbtc.address,
                                10
                            );
                            renTokens[0].should.equal(renbtc.address);
                            renTokens[1].should.equal(NULL);
                            renTokens.length.should.equal(10);
                        }

                        {
                            // Get all the gateways starting from first entry
                            const gateways = await registry.getGateways.call(
                                btcGateway.address,
                                0
                            );
                            gateways[0].should.equal(btcGateway.address);
                            gateways.length.should.equal(1);

                            const renTokens = await registry.getRenTokens.call(
                                renbtc.address,
                                0
                            );
                            renTokens[0].should.equal(renbtc.address);
                            renTokens.length.should.equal(1);
                        }
                    });

                    it("can update gateway for a token", async () => {
                        (
                            await registry.getGatewayByToken.call(
                                renbtc.address
                            )
                        ).should.equal(btcGateway.address);

                        const newBtcGateway = await deployProxy<
                            GatewayLogicV1Instance
                        >(
                            web3,
                            BTCGateway,
                            GatewayLogicV1,
                            proxyGovernanceAddress,
                            [
                                { type: "address", value: renbtc.address },
                                { type: "address", value: feeRecipient },
                                {
                                    type: "address",
                                    value: mintAuthority.address
                                },
                                { type: "uint16", value: mintFees.toString() },
                                { type: "uint16", value: burnFees.toString() },
                                { type: "uint256", value: 10000 }
                            ],
                            { from: owner }
                        );

                        await registry.updateGateway(
                            renbtc.address,
                            newBtcGateway.address
                        );

                        (
                            await registry.getGatewayByToken.call(
                                renbtc.address
                            )
                        ).should.equal(newBtcGateway.address);
                    });

                    it("can't update gateway for an unregistered token", async () => {
                        await registry
                            .updateGateway(ETHEREUM, randomAddress())
                            .should.be.rejectedWith(
                                /GatewayRegistry: token not registered/
                            );
                    });

                    it("can deregister gateways", async () => {
                        await registry.removeGateway("BTC");

                        await registry
                            .removeGateway("BTC")
                            .should.be.rejectedWith(
                                /GatewayRegistry: symbol not registered/
                            );
                    });

                    it("should be able to withdraw funds that are mistakenly sent to the Gateway Registry", async () => {
                        const ren = await RenToken.deployed();
                        await ren.transfer(registry.address, 1000);

                        // Only the owner can recover tokens
                        await registry
                            .recoverTokens(ren.address, { from: malicious })
                            .should.be.rejectedWith(
                                /Ownable: caller is not the owner/
                            );

                        // Can recover unrelated token
                        const initialRenBalance = new BN(
                            (await ren.balanceOf.call(owner)).toString()
                        );
                        await registry.recoverTokens(ren.address, {
                            from: owner
                        });
                        const finalRenBalance = new BN(
                            (await ren.balanceOf.call(owner)).toString()
                        );
                        finalRenBalance
                            .sub(initialRenBalance)
                            .should.bignumber.equal(1000);
                    });

                    it("can renounce ownership of the registry", async () => {
                        await registry.renounceOwnership();
                    });
                });
            });
        }
    }
);
