
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as chaiBigNumber from "chai-bignumber";
import * as crypto from "crypto";

import BigNumber from "bignumber.js";

import { BN } from "bn.js";

import { DarknodeRegistryContract } from "../bindings/darknode_registry";

// Import chai log helper
import "./logs";

chai.use(chaiAsPromised);
chai.use(chaiBigNumber(BigNumber));
chai.should();

const config = require("../../migrations/config.js");
export const { MINIMUM_POD_SIZE, MINIMUM_EPOCH_INTERVAL } = config;

export const MINIMUM_BOND = new BN(config.MINIMUM_BOND);

export const ETHEREUM_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Makes an ID for a darknode
export function ID(i: string | number) {
    return web3.utils.toChecksumAddress(web3.utils.sha3(i.toString()).slice(0, 42));
}

// Makes a public key for a darknode
export function PUBK(i: string | number) {
    return web3.utils.sha3(i.toString());
}

export const NULL = "0x0000000000000000000000000000000000000000";
export const NULL32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const randomBytes = (bytes: number): string => {
    return `0x${crypto.randomBytes(bytes).toString("hex")}`;
};

export const randomAddress = (): string => {
    return web3.utils.toChecksumAddress(randomBytes(20));
};

export const increaseTime = async (seconds: number) => {
    await new Promise((resolve, reject) => {
        web3.currentProvider.send(
            { jsonrpc: "2.0", method: "evm_increaseTime", params: [seconds], id: 0 },
            (err, value) => {
                if (err) {
                    reject(err);
                }
                resolve(value);
            }
        );
    });
};

export async function waitForEpoch(dnr: DarknodeRegistryContract) {
    const timeout = MINIMUM_EPOCH_INTERVAL * 0.1;
    while (true) {
        // Must be an on-chain call, or the time won't be updated
        try {
            await dnr.epoch();
            return;
        } catch (err) {
            // epoch reverted, epoch interval hasn't passed
        }
        // Sleep for `timeout` seconds
        await new Promise((resolve) => setTimeout(resolve, timeout * 1000));
    }
}

export const randomID = () => {
    return web3.utils.sha3(Math.random().toString());
};

export const openPrefix = web3.utils.toHex("Republic Protocol: open: ");
export const closePrefix = web3.utils.toHex("Republic Protocol: cancel: ");
