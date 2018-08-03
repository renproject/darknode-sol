
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as chaiBigNumber from "chai-bignumber";

import BigNumber from "bignumber.js";

chai.use(chaiAsPromised);
chai.use(chaiBigNumber(BigNumber));
chai.should();

const config = require("../../migrations/config.js");
export const { INGRESS_FEE, MINIMUM_POD_SIZE, MINIMUM_EPOCH_INTERVAL } = config;
export const MINIMUM_BOND = new BigNumber(config.MINIMUM_BOND);

// Makes an ID for a darknode
export function ID(i: string) {
    return web3.utils.sha3(i).slice(0, 42);
}

// Makes a public key for a darknode
export function PUBK(i: string) {
    return web3.utils.sha3(i);
}

export const NULL = "0x0000000000000000000000000000000000000000";

export async function waitForEpoch(dnr: any) {
    // TODO: Replace with evm_increaseTime
    const timeout = MINIMUM_EPOCH_INTERVAL * 0.1;
    while (true) {
        // Must be an on-chain call, or the time won't be updated
        try {
            const tx = await dnr.epoch();
            return;
        } catch (err) {
            // epoch reverted, epoch interval hasn't passed
        }
        // Sleep for `timeout` seconds
        await new Promise(resolve => setTimeout(resolve, timeout * 1000));
    }
}

export const randomID = () => {
    return web3.utils.sha3(Math.random().toString());
};

const openPrefix = web3.utils.toHex("Republic Protocol: open: ");
const closePrefix = web3.utils.toHex("Republic Protocol: cancel: ");

export const openBuyOrder = async (orderbook, broker, account, orderID?) => {
    if (!orderID) {
        orderID = randomID();
    }

    let hash = openPrefix + orderID.slice(2);
    let signature = await web3.eth.sign(hash, account);
    await orderbook.openBuyOrder(signature, orderID, { from: broker });

    return orderID;
};

export const openSellOrder = async (orderbook, broker, account, orderID?) => {
    if (!orderID) {
        orderID = randomID();
    }

    let hash = openPrefix + orderID.slice(2);
    let signature = await web3.eth.sign(hash, account);
    await orderbook.openSellOrder(signature, orderID, { from: broker });

    return orderID;
};

export const cancelOrder = async (orderbook, broker, account, orderID) => {
    // Cancel canceled order
    const hash = closePrefix + orderID.slice(2);
    const signature = await web3.eth.sign(hash, account);
    await orderbook.cancelOrder(signature, orderID, { from: broker });
};