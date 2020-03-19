import BN from "bn.js";
import { ecsign } from "ethereumjs-util";
import { Account } from "web3-eth-accounts";
import { keccak256 } from "web3-utils";

import {
    BTCGatewayInstance, GatewayRegistryInstance, renBTCInstance,
} from "../types/truffle-contracts";
import { Ox, randomBytes } from "./helper/testUtils";

const BasicAdapter = artifacts.require("BasicAdapter");
const BTCGateway = artifacts.require("BTCGateway");
const GatewayRegistry = artifacts.require("GatewayRegistry");
const renBTC = artifacts.require("renBTC");

contract("Gateway", ([owner, feeRecipient, user]) => {
    let btcGateway: BTCGatewayInstance;
    let renbtc: renBTCInstance;
    let registry: GatewayRegistryInstance;

    // We generate a new account so that we have access to its private key for
    // `ecsign`. Web3's sign functions all prefix the message being signed.
    let mintAuthority: Account;
    let privKey: Buffer;

    const mintFees = new BN(5);
    const burnFees = new BN(15);

    before(async () => {
        renbtc = await renBTC.new();
        mintAuthority = web3.eth.accounts.create();
        privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex");

        btcGateway = await BTCGateway.new(
            renbtc.address,
            feeRecipient,
            mintAuthority.address,
            mintFees,
            burnFees,
            10000,
        );

        registry = await GatewayRegistry.new();
        await registry.setGateway(renbtc.address, btcGateway.address);

        await renbtc.transferOwnership(btcGateway.address);
        await btcGateway.claimTokenOwnership();
    });

    const removeFee = (value: number | BN, bips: number | BN) =>
        new BN(value).sub(new BN(value).mul(new BN(bips)).div(new BN(10000)));

    it("can mint to an adapter", async () => {
        const value = new BN(20000);
        const burnValue = removeFee(value, mintFees);

        const basicAdapter = await BasicAdapter.new(registry.address);

        const nHash = randomBytes(32);
        const bitcoinAddress = "0x" + Buffer.from("BITCOIN ADDRESS").toString("hex");

        const pHash = keccak256(web3.eth.abi.encodeParameters(
            ["string", "address"],
            ["renBTC", user],
        ));

        const hash = await btcGateway.hashForSignature.call(pHash, value, basicAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

        const balanceBeforeMint = new BN((await renbtc.balanceOf.call(user)).toString());
        await basicAdapter.mint("renBTC", user, value, nHash, sigString);
        const balanceAfterMint = new BN((await renbtc.balanceOf.call(user)).toString());
        balanceAfterMint.should.bignumber.equal(balanceBeforeMint.add(burnValue));

        await renbtc.approve(basicAdapter.address, burnValue, { from: user });
        await basicAdapter.burn("renBTC", bitcoinAddress, burnValue, { from: user });
        (await renbtc.balanceOf.call(user)).should.bignumber.equal(balanceAfterMint.sub(burnValue));
    });
});
