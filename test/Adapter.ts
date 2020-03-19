import BN from "bn.js";
import { ecsign } from "ethereumjs-util";
import { Account } from "web3-eth-accounts";
import { keccak256 } from "web3-utils";

import {
    BTCShifterInstance, ShifterRegistryInstance, zBTCInstance,
} from "../types/truffle-contracts";
import { Ox, randomBytes } from "./helper/testUtils";

const BasicAdapter = artifacts.require("BasicAdapter");
const BTCShifter = artifacts.require("BTCShifter");
const ShifterRegistry = artifacts.require("ShifterRegistry");
const zBTC = artifacts.require("zBTC");

contract("Shifter", ([owner, feeRecipient, user]) => {
    let btcShifter: BTCShifterInstance;
    let zbtc: zBTCInstance;
    let registry: ShifterRegistryInstance;

    // We generate a new account so that we have access to its private key for
    // `ecsign`. Web3's sign functions all prefix the message being signed.
    let mintAuthority: Account;
    let privKey: Buffer;

    const shiftInFees = new BN(5);
    const shiftOutFees = new BN(15);

    before(async () => {
        zbtc = await zBTC.new();
        mintAuthority = web3.eth.accounts.create();
        privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex");

        btcShifter = await BTCShifter.new(
            zbtc.address,
            feeRecipient,
            mintAuthority.address,
            shiftInFees,
            shiftOutFees,
            10000,
        );

        registry = await ShifterRegistry.new();
        await registry.setShifter(zbtc.address, btcShifter.address);

        await zbtc.transferOwnership(btcShifter.address);
        await btcShifter.claimTokenOwnership();
    });

    const removeFee = (value: number | BN, bips: number | BN) =>
        new BN(value).sub(new BN(value).mul(new BN(bips)).div(new BN(10000)));

    it("can mint to an adapter", async () => {
        // Shift In
        const value = new BN(20000);
        const burnValue = removeFee(value, shiftInFees);

        const basicAdapter = await BasicAdapter.new(registry.address);

        const nHash = randomBytes(32);
        const bitcoinAddress = "0x" + Buffer.from("BITCOIN ADDRESS").toString("hex");

        const pHash = keccak256(web3.eth.abi.encodeParameters(
            ["string", "address"],
            ["zBTC", user],
        ));

        const hash = await btcShifter.hashForSignature.call(pHash, value, basicAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

        const balanceBeforeMint = new BN((await zbtc.balanceOf.call(user)).toString());
        await basicAdapter.shiftIn("zBTC", user, value, nHash, sigString);
        const balanceAfterMint = new BN((await zbtc.balanceOf.call(user)).toString());
        balanceAfterMint.should.bignumber.equal(balanceBeforeMint.add(burnValue));

        await zbtc.approve(basicAdapter.address, burnValue, { from: user });
        await basicAdapter.shiftOut("zBTC", bitcoinAddress, burnValue, { from: user });
        (await zbtc.balanceOf.call(user)).should.bignumber.equal(balanceAfterMint.sub(burnValue));
    });
});
