import BN from "bn.js";
import { ecsign } from "ethereumjs-util";
import { Account } from "web3-eth-accounts";
import { keccak256 } from "web3-utils";

import {
    BasicAdapterInstance, BTCShifterInstance, ConfirmationlessShifterInstance, ShifterInstance,
    ShifterRegistryInstance, zBTCInstance,
} from "../types/truffle-contracts";
import { Ox, randomBytes, sigToString, strip0x } from "./helper/testUtils";

const BTCShifter = artifacts.require("BTCShifter");
const BasicAdapter = artifacts.require("BasicAdapter");
const ConfirmationlessShifter = artifacts.require("ConfirmationlessShifter");
const ShifterRegistry = artifacts.require("ShifterRegistry");
const zBTC = artifacts.require("zBTC");

contract("ComposableShifter", ([owner, feeRecipient, user, provider]) => {
    let btcShifter: BTCShifterInstance;
    let basicAdapter: BasicAdapterInstance;
    let confirmationlessShifter: ConfirmationlessShifterInstance;
    let shifterRegistry: ShifterRegistryInstance;
    let zbtc: zBTCInstance;

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

        shifterRegistry = await ShifterRegistry.new();
        await shifterRegistry.setShifter(zbtc.address, btcShifter.address);

        basicAdapter = await BasicAdapter.new();
        confirmationlessShifter = await ConfirmationlessShifter.new(shifterRegistry.address, await zbtc.symbol.call());

        await zbtc.transferOwnership(btcShifter.address);
        await btcShifter.claimTokenOwnership();
    });

    const mintTo = async (address: string, value: BN | number) => {
        const [nHash, pHash] = [randomBytes(32), randomBytes(32)];

        const hash = await btcShifter.hashForSignature.call(pHash, value, user, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

        await btcShifter.shiftIn(pHash, value, nHash, sigToString(sig), { from: user });
        await zbtc.transfer(address, removeFee(value, shiftInFees), { from: user });
    };

    const removeFee = (value: number | BN, bips: number | BN) =>
        new BN(value).sub(new BN(value).mul(new BN(bips)).div(new BN(10000)));

    describe("confirmationless", () => {
        const value = new BN(20000);

        it("can shift in normally", async () => {
            const nHash = randomBytes(32);

            const confirmationFee = 100;

            const basicAdapterWeb3 = new web3.eth.Contract((BasicAdapter as any)._json.abi, basicAdapter.address);
            const basicAdapterCall = basicAdapterWeb3.methods.shiftIn(confirmationlessShifter.address, zbtc.address, user, "0", nHash, "0x00").encodeABI();
            // const basicAdapterCall = ((basicAdapter.shiftIn as any).request(confirmationlessShifter.address, zbtc.address, user, "0", nHash, "0x00"));

            const [basicAdapterCallBeforeNHash, basicAdapterCallAfterNHash] = basicAdapterCall.split(strip0x(nHash)).map(Ox);

            const pHash = keccak256(web3.eth.abi.encodeParameters(
                ["uint256", "address", "bytes", "bytes"],
                [confirmationFee, basicAdapter.address, basicAdapterCallBeforeNHash, basicAdapterCallAfterNHash],
            ));

            const hash = await btcShifter.hashForSignature.call(pHash, value, confirmationlessShifter.address, nHash);
            const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

            const balanceBefore = new BN((await zbtc.balanceOf.call(user)).toString());
            // const _shiftID = await btcShifter.nextShiftID.call();
            await confirmationlessShifter.composeShiftIn(confirmationFee, basicAdapter.address, basicAdapterCallBeforeNHash, basicAdapterCallAfterNHash, value, nHash, sigToString(sig), { from: user });
            (await zbtc.balanceOf.call(user)).should.bignumber.equal(balanceBefore.add(removeFee(value, shiftInFees)));
        });

        it("can shift in with provider", async () => {
            await mintTo(provider, value);
            await zbtc.approve(confirmationlessShifter.address, value, { from: provider });

            const nHash = randomBytes(32);

            const confirmationFee = 100;

            const basicAdapterWeb3 = new web3.eth.Contract((BasicAdapter as any)._json.abi, basicAdapter.address);
            const basicAdapterCall = basicAdapterWeb3.methods.shiftIn(confirmationlessShifter.address, zbtc.address, user, "0", nHash, "0x00").encodeABI();
            // const basicAdapterCall = ((basicAdapter.shiftIn as any).request(confirmationlessShifter.address, zbtc.address, user, "0", forwardedNHash, "0x00"));

            const [basicAdapterCallBeforeNHash, basicAdapterCallAfterNHash] = basicAdapterCall.split(strip0x(nHash)).map(Ox);

            const pHash = keccak256(web3.eth.abi.encodeParameters(
                ["uint256", "address", "bytes", "bytes"],
                [confirmationFee, basicAdapter.address, basicAdapterCallBeforeNHash, basicAdapterCallAfterNHash],
            ));

            const balanceBeforeProvider = new BN((await zbtc.balanceOf.call(provider)).toString());

            const balanceBefore = new BN((await zbtc.balanceOf.call(user)).toString());
            await confirmationlessShifter.composeShiftIn(confirmationFee, basicAdapter.address, basicAdapterCallBeforeNHash, basicAdapterCallAfterNHash, value, nHash, Buffer.from([]) as any, { from: provider });
            (await zbtc.balanceOf.call(user)).should.bignumber.equal(balanceBefore.add(removeFee(value, shiftInFees)).sub(new BN(confirmationFee)));

            const hash = await btcShifter.hashForSignature.call(pHash, value, confirmationlessShifter.address, nHash);
            const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);

            await confirmationlessShifter.composeShiftIn(confirmationFee, basicAdapter.address, basicAdapterCallBeforeNHash, basicAdapterCallAfterNHash, value, nHash, sigToString(sig), { from: user });

            (await zbtc.balanceOf.call(provider)).should.bignumber.equal(balanceBeforeProvider.add(new BN(confirmationFee)));
        });
    });
});
