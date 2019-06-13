import { ec } from "elliptic";
import BN from "bn.js";
import { randomBytes } from "crypto";
import { ecsign } from "ethereumjs-util";

import { ERC20ShiftedInstance, ShifterInstance } from "../types/truffle-contracts";
import "./helper/testUtils";

const Shifter = artifacts.require("Shifter");
const ERC20Shifted = artifacts.require("ERC20Shifted");

contract("Shifter", (accounts) => {
    let shifter: ShifterInstance;
    let token: ERC20ShiftedInstance;

    const ownerAccount = web3.eth.accounts.create();
    const privKey = Buffer.from(ownerAccount.privateKey.slice(2), "hex");
    const feeInBips = new BN(10);

    before(async () => {
        shifter = await Shifter.new(ownerAccount.address, accounts[1], feeInBips);
        await shifter.newShiftedToken("TestShifter", "ts", 8);
        const tokenAddress = await shifter.shiftedTokens("ts");
        token = await ERC20Shifted.at(tokenAddress);
    });

    it("can mint tokens with an unused hash, valid signature and commitment", async () => {
        const value = new BN(200000);
        const txhash = `0x${randomBytes(32).toString("hex")}`
        const hash = await shifter.sigHash(token.address, accounts[2], value.toNumber(), txhash, "0x00");
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey)

        var sigString = `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`;

        await shifter.shiftIn(token.address, accounts[2], value.toNumber(), txhash, "0x00", sigString);
    });
});