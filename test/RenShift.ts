import { ec } from "elliptic";
import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecsign } from "ethereumjs-util";

import { ERC20ShiftedInstance, RenShiftInstance } from "../types/truffle-contracts";
import "./helper/testUtils";

const RenShift = artifacts.require("RenShift");
const ERC20Shifted = artifacts.require("ERC20Shifted");

contract("RenShift", (accounts) => {
    let renShift: RenShiftInstance;
    let token: ERC20ShiftedInstance;

    const ownerAccount = web3.eth.accounts.create();
    const privKey = Buffer.from(ownerAccount.privateKey.slice(2), "hex");
    const feeInBips = new BN(10);

    before(async () => {
        renShift = await RenShift.new(ownerAccount.address, accounts[1], feeInBips);
        await renShift.newShiftedToken("TestShifter", "ts", 8);
        const tokenAddress = await renShift.shiftedTokens("ts");
        token = await ERC20Shifted.at(tokenAddress);
    });

    it("can mint tokens with an unused hash, valid signature and commitment", async () => {
        const value = new BN(200000);
        const txhash = `0x${randomBytes(32).toString("hex")}`
        const hash = await renShift.sigHash(token.address, accounts[2], value.toNumber(), txhash, "0x00");
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey)

        var sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;

        await renShift.shiftIn(token.address, accounts[2], value.toNumber(), txhash, "0x00", sigString);
    });
});