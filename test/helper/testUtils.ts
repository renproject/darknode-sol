import * as chai from "chai";
import * as crypto from "crypto";

import BigNumber from "bignumber.js";
import BN from "bn.js";
import chaiAsPromised from "chai-as-promised";
import chaiBigNumber from "chai-bignumber";
import { keccak256, toChecksumAddress, toHex } from "web3-utils";

import { DarknodeRegistryInstance } from "../../types/truffle-contracts";
// Import chai log helper
import "./logs";

chai.use(chaiAsPromised);
chai.use((chaiBigNumber as any)(BigNumber) as any);
chai.should();

const networkAddresses = require("../../migrations/networks.js");
const config = networkAddresses.config;
export const { MINIMUM_POD_SIZE, MINIMUM_EPOCH_INTERVAL_SECONDS } = config;

export const MINIMUM_BOND = new BN(config.MINIMUM_BOND);

export const ETHEREUM_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Makes an ID for a darknode
export function ID(i: string | number) {
    return toChecksumAddress(keccak256(i.toString()).slice(0, 42));
}

// Makes a public key for a darknode
export function PUBK(i: string | number) {
    return keccak256(i.toString());
}

export const NULL = "0x0000000000000000000000000000000000000000";
export const NULL32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Add a 0x prefix to a hex value, converting to a string first
export const Ox = (hex: string | BN | Buffer) => {
    const hexString = typeof hex === "string" ? hex : hex.toString("hex");
    return hexString.substring(0, 2) === "0x" ? hexString : `0x${hexString}`;
};

export const randomBytes = (bytes: number): string => {
    return Ox(crypto.randomBytes(bytes));
};

export const randomAddress = (): string => {
    return toChecksumAddress(randomBytes(20));
};

const increaseTimeHelper = async (seconds: number) => {
    await new Promise((resolve, reject) => {
        // tslint:disable-next-line: no-floating-promises
        return web3.currentProvider.send(
            { jsonrpc: "2.0", method: "evm_increaseTime", params: [seconds], id: 0 } as any,
            ((err: Error) => {
                if (err) {
                    reject(err);
                }
                // tslint:disable-next-line: no-floating-promises
                return web3.currentProvider.send({
                    jsonrpc: "2.0",
                    method: "evm_mine",
                    params: [],
                    id: new Date().getSeconds(),
                } as any, ((innerErr: Error) => {
                    if (innerErr) {
                        reject();
                    }
                    resolve();
                }) as any);
            }) as any,
        );
    });
};

const getCurrentTimestamp = async (): Promise<number> =>
    parseInt((await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp.toString(), 10);

export const increaseTime = async (seconds: number) => {
    let currentTimestamp = await getCurrentTimestamp();
    const target = currentTimestamp + seconds;
    do {
        const increase = Math.ceil(target - currentTimestamp + 1);
        await increaseTimeHelper(increase);
        currentTimestamp = await getCurrentTimestamp();
    } while (currentTimestamp < target);
};

export async function waitForEpoch(dnr: DarknodeRegistryInstance) {
    const timeout = MINIMUM_EPOCH_INTERVAL_SECONDS;
    while (true) {
        // Must be an on-chain call, or the time won't be updated
        try {
            await dnr.epoch();
            return;
        } catch (err) {
            // epoch reverted, epoch interval hasn't passed
        }
        // Sleep for `timeout` seconds
        await increaseTime(timeout);
        // await new Promise((resolve) => setTimeout(resolve, timeout * 1000));
    }
}

export const randomID = () => {
    return keccak256(Math.random().toString());
};

export const encodeCallData = (functioName: string, parameterTypes: string[], parameters: any[]) => {
    return web3.eth.abi.encodeFunctionSignature(`${functioName}(${parameterTypes.join(",")})`) +
        web3.eth.abi.encodeParameters(parameterTypes, parameters).slice(2);
};
