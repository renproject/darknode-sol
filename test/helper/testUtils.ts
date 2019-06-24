import * as chai from "chai";
import * as crypto from "crypto";

// @ts-ignore
import chaiAsPromised from "chai-as-promised";
// @ts-ignore
import chaiBigNumber from "chai-bignumber";
import BigNumber from "bignumber.js";
import BN from "bn.js";
import { keccak256, toChecksumAddress, toHex } from "web3-utils";

import { DarknodeRegistryInstance } from "../../types/truffle-contracts";
// Import chai log helper
import "./logs";

chai.use(chaiAsPromised);
chai.use((chaiBigNumber as any)(BigNumber) as any);
chai.should();

const networkAddresses = require("../../migrations/networks.js");
const config = networkAddresses.config;
export const { MINIMUM_POD_SIZE, MINIMUM_EPOCH_INTERVAL } = config;

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

export const randomBytes = (bytes: number): string => {
    return `0x${crypto.randomBytes(bytes).toString("hex")}`;
};

export const randomAddress = (): string => {
    return toChecksumAddress(randomBytes(20));
};

const increaseTimeHelper = async (seconds: number) => {
    await new Promise((resolve, reject) => {
        web3.currentProvider.send(
            { jsonrpc: "2.0", method: "evm_increaseTime", params: [seconds], id: 0 } as any,
            ((err, _) => {
                if (err) {
                    reject(err);
                }
                web3.currentProvider.send({
                    jsonrpc: '2.0',
                    method: 'evm_mine',
                    params: [],
                    id: new Date().getSeconds()
                } as any, ((err, _) => {
                    if (err) {
                        reject();
                    }
                    resolve();
                }) as any);
            }) as any
        )
    });
}

const getCurrentTimestamp = async (): Promise<number> => parseInt((await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp.toString(), 10);

export const increaseTime = async (seconds: number) => {
    let currentTimestamp = await getCurrentTimestamp();
    const target = currentTimestamp + seconds;
    do {
        const increase = Math.ceil(target - currentTimestamp + 1);
        await increaseTimeHelper(increase);
        currentTimestamp = await getCurrentTimestamp();
        // console.log(`Increased by ${increase} to ${currentTimestamp}. Target is ${target}. Reached: ${currentTimestamp >= target}`);
    } while (currentTimestamp < target);
};

export async function waitForEpoch(dnr: DarknodeRegistryInstance) {
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
        await increaseTime(timeout);
        // await new Promise((resolve) => setTimeout(resolve, timeout * 1000));
    }
}

export const randomID = () => {
    return keccak256(Math.random().toString());
};

export const openPrefix = toHex("Republic Protocol: open: ");
export const closePrefix = toHex("Republic Protocol: cancel: ");
