import BN from "bn.js";
import { rawEncode, solidityPack } from "ethereumjs-abi";
import {
    ecrecover,
    ecsign,
    isValidSignature,
    keccak256,
    pubToAddress
} from "ethereumjs-util";
import { toChecksumAddress } from "web3-utils";

import {
    RenERC20LogicV1Instance,
    RenProxyAdminInstance
} from "../types/truffle-contracts";
import { log } from "./helper/logs";
import {
    deployProxy,
    hexToBuffer,
    increaseTime,
    NULL,
    NULL32,
    Ox
} from "./helper/testUtils";

const RenERC20LogicV1 = artifacts.require("RenERC20LogicV1");
const RenBTC = artifacts.require("RenBTC");
const RenProxyAdmin = artifacts.require("RenProxyAdmin");

const MAX = new BN(2).pow(new BN(256)).sub(new BN(1));

const signPermit = async (
    token: RenERC20LogicV1Instance,
    privateKey: Buffer,
    from: string,
    to: string,
    allowed: boolean
) => {
    const nonce = await token.nonces.call(from);
    const expiry = Math.round(new Date().getTime() / 1000) + 1 /* second */;

    const DOMAIN_SEPARATOR = hexToBuffer(await token.DOMAIN_SEPARATOR.call());
    const PERMIT_TYPEHASH = hexToBuffer(await token.PERMIT_TYPEHASH.call());

    const digest = keccak256(
        solidityPack(
            ["string", "bytes32", "bytes32"],
            [
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    rawEncode(
                        [
                            "bytes32",
                            "address",
                            "address",
                            "uint256",
                            "uint256",
                            "bool"
                        ],
                        [PERMIT_TYPEHASH, from, to, nonce, expiry, allowed]
                    )
                )
            ]
        )
    );

    const { r, s, v } = ecsign(digest, privateKey);
    // signature.length.should.equal(2 * (32 + 32 + 1));
    // const [r, s, v] = [Buffer.from(signature.slice(0, 64)), Buffer.from(signature.slice(64, 128)), parseInt(signature.slice(128, 130), 16) % 27 + 27];
    isValidSignature(v, r, s);
    toChecksumAddress(
        Ox(pubToAddress(ecrecover(digest, v, r, s)))
    ).should.equal(from);

    return { r, s, v, nonce, expiry };
};

const submitPermit = async (
    token: RenERC20LogicV1Instance,
    privateKey: Buffer,
    from: string,
    to: string,
    allowed: boolean
) => {
    const { r, s, v, nonce, expiry } = await signPermit(
        token,
        privateKey,
        from,
        to,
        allowed
    );

    return token.permit(from, to, nonce, expiry, allowed, v, Ox(r), Ox(s), {
        from: to
    });
};

contract("ERC20WithPermit", ([owner, secondUser, malicious]) => {
    let token: RenERC20LogicV1Instance;
    let proxyAdmin: RenProxyAdminInstance;

    const firstUserAcc = web3.eth.accounts.create();
    const firstUser = firstUserAcc.address;
    const privateKey = Buffer.from(firstUserAcc.privateKey.slice(2), "hex");

    before(async () => {
        proxyAdmin = await RenProxyAdmin.new();
        token = await deployProxy<RenERC20LogicV1Instance>(
            web3,
            RenBTC,
            RenERC20LogicV1,
            proxyAdmin.address,
            [
                {
                    name: "_chainId",
                    type: "uint256",
                    value: await web3.eth.net.getId()
                },
                { name: "_nextOwner", type: "address", value: owner },
                {
                    name: "_initialRate",
                    type: "uint256",
                    value: "500000000000000000"
                },
                { name: "_version", type: "string", value: "1" },
                { name: "_name", type: "string", value: "renBTC" },
                { name: "_symbol", type: "string", value: "renBTC" },
                { name: "_decimals", type: "uint8", value: 8 }
            ],
            { from: owner }
        );
        await token.mint(firstUser, new BN(10).mul(new BN(10).pow(new BN(18))));
    });

    it("approve with permit", async () => {
        const value = new BN(1).mul(new BN(10).pow(new BN(18)));

        const firstBefore = new BN(await token.balanceOf.call(firstUser));
        const secondBefore = new BN(await token.balanceOf.call(secondUser));

        // Approve and deposit
        ((await submitPermit(
            token,
            privateKey,
            firstUser,
            secondUser,
            true
        )) as any).should.emit.logs([
            log("Approval", {
                owner: firstUser,
                spender: secondUser,
                value: MAX
            })
        ]);
        (
            await token.allowance.call(firstUser, secondUser)
        ).should.bignumber.equal(MAX);

        await token.transferFrom(firstUser, secondUser, value, {
            from: secondUser
        });

        // Compare balances after depositing
        (await token.balanceOf.call(firstUser)).should.bignumber.equal(
            firstBefore.sub(new BN(value))
        );
        (await token.balanceOf.call(secondUser)).should.bignumber.equal(
            secondBefore.add(new BN(value))
        );
    });

    it("revoke approval", async () => {
        await submitPermit(token, privateKey, firstUser, secondUser, true);
        (
            await token.allowance.call(firstUser, secondUser)
        ).should.bignumber.equal(MAX);

        ((await submitPermit(
            token,
            privateKey,
            firstUser,
            secondUser,
            false
        )) as any).should.emit.logs([
            log("Approval", {
                owner: firstUser,
                spender: secondUser,
                value: new BN(0)
            })
        ]);

        (
            await token.allowance.call(firstUser, secondUser)
        ).should.bignumber.equal(0);
    });

    it("can't resubmit signature", async () => {
        // Approve and deposit
        const { r, s, v, nonce, expiry } = await signPermit(
            token,
            privateKey,
            firstUser,
            malicious,
            true
        );
        await token.permit(
            firstUser,
            malicious,
            nonce,
            expiry,
            true,
            v,
            Ox(r),
            Ox(s),
            { from: malicious }
        );
        await submitPermit(token, privateKey, firstUser, malicious, false);

        await token
            .permit(
                firstUser,
                malicious,
                nonce,
                expiry,
                true,
                v,
                Ox(r),
                Ox(s),
                { from: malicious }
            )
            .should.be.rejectedWith(/ERC20WithRate: invalid nonce/);

        await token
            .permit(
                firstUser,
                malicious,
                await token.nonces.call(firstUser),
                expiry,
                true,
                v,
                Ox(r),
                Ox(s),
                { from: malicious }
            )
            .should.be.rejectedWith(/ERC20WithRate: invalid signature/);
    });

    it("can't change address", async () => {
        // Approve and deposit
        const { r, s, v, nonce, expiry } = await signPermit(
            token,
            privateKey,
            firstUser,
            secondUser,
            true
        );
        await token
            .permit(
                firstUser,
                malicious,
                nonce,
                expiry,
                true,
                v,
                Ox(r),
                Ox(s),
                { from: malicious }
            )
            .should.be.rejectedWith(/ERC20WithRate: invalid signature/);
    });

    it("can't submit expired permit", async () => {
        // Approve and deposit
        const { r, s, v, nonce, expiry } = await signPermit(
            token,
            privateKey,
            firstUser,
            malicious,
            true
        );
        await increaseTime(expiry + 1);
        await token
            .permit(
                firstUser,
                malicious,
                nonce,
                expiry,
                true,
                v,
                Ox(r),
                Ox(s),
                { from: malicious }
            )
            .should.be.rejectedWith(/ERC20WithRate: permit has expired/);
    });

    it("can't submit permit for 0x0", async () => {
        // Approve and deposit
        const nonce = new BN(0);
        const expiry = Math.round(new Date().getTime() / 1000) + 1 /* second */;

        await token
            .permit(NULL, malicious, nonce, expiry, true, 27, NULL32, NULL32, {
                from: malicious
            })
            .should.be.rejectedWith(/ERC20WithRate: address must not be 0x0/);
    });
});
