import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as chaiBigNumber from "chai-bignumber";
import * as crypto from "crypto";

import BigNumber from "bignumber.js";
// import * as Web3 from "web3";

import { DarknodeRegistryContract } from "../bindings/darknode_registry";
import { OrderbookContract } from "../bindings/orderbook";

// Import chai helpers
import "./address";
import "./logs";

chai.use(chaiAsPromised);
chai.use(chaiBigNumber(BigNumber));
chai.should();

const config = require("../../migrations/config.js");
export const { MINIMUM_POD_SIZE, MINIMUM_EPOCH_INTERVAL } = config;

export const MINIMUM_BOND = new BigNumber(config.MINIMUM_BOND);

// Makes a check-summed ID for a darknode
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

export async function waitForEpoch(dnr: DarknodeRegistryContract, options: { from: string }) {
    const timeout = MINIMUM_EPOCH_INTERVAL * 0.1;
    while (true) {
        // Must be an on-chain call, or the time won't be updated
        try {
            // Uses `as any` because types require a { from } options field
            await dnr.epoch(options);
            return;
        } catch (err) {
            if (!("" + err).match(/epoch interval has not passed/)) {
                throw err;
            }
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

export enum Parity {
    BUY = 0,
    SELL = 1,
}

export const openBuyOrder = (
    orderbook: OrderbookContract,
    settlementID: number,
    account: string,
    orderID?: string,
) => openOrder(orderbook, settlementID, account, Parity.BUY, orderID);

export const openSellOrder = (
    orderbook: OrderbookContract,
    settlementID: number,
    account: string,
    orderID?: string,
) => openOrder(orderbook, settlementID, account, Parity.SELL, orderID);

export const openOrder = async (
    orderbook: OrderbookContract,
    settlementID: number,
    account: string,
    parity: Parity,
    orderID?: string,
) => {
    if (!orderID) {
        orderID = randomID();
    }

    // Use random 65 bytes so that the gas aren't skewed by not having a
    // signature
    const signature = randomBytes(65);
    if (parity === Parity.BUY) {
        await orderbook.openBuyOrder(settlementID, signature, orderID, 0, 0, { from: account });
    } else {
        await orderbook.openSellOrder(settlementID, signature, orderID, 0, 0, { from: account });
    }

    return orderID;
};

export const cancelOrder = async (orderbook: OrderbookContract, account: string, orderID: string) => {
    await orderbook.cancelOrder(orderID, { from: account });
};

export const web3Sign = (web3, bytes: string, account: string): Promise<string> => {
    const oldVersion = web3.version.api && web3.version.api.slice(0, 1) === "0";
    if (oldVersion) {
        return web3.eth.sign(account, bytes);
    } else {
        return web3.eth.sign(bytes, account);
    }
};
