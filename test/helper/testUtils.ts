// Import chai log helper
import "./logs";

import * as crypto from "crypto";

import BigNumber from "bignumber.js";
import BN from "bn.js";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiBigNumber from "chai-bignumber";
import { ECDSASignature } from "ethereumjs-util";
import { TransactionReceipt } from "web3-core";
import { keccak256, toChecksumAddress } from "web3-utils";

import { DarknodeRegistryLogicV3Instance } from "../../types/truffle-contracts";

const ERC20 = artifacts.require("PaymentToken");

chai.use(chaiAsPromised);
chai.use((chaiBigNumber as any)(BigNumber) );
chai.should();

export const { encodeCallData } = require("../../migrations/encode.js");

const networkAddresses = require("../../migrations/networks.js");

const config = networkAddresses.config;
export const { MINIMUM_POD_SIZE, MINIMUM_EPOCH_INTERVAL_SECONDS } = config;

export const MINIMUM_BOND = new BN(config.MINIMUM_BOND);

export const ETHEREUM = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Makes an ID for a darknode
export function ID(i: string | number) {
    return toChecksumAddress(keccak256(i.toString()).slice(0, 42));
}

// Makes a public key for a darknode
export function PUBK(i: string | number) {
    return keccak256(i.toString());
}

export const NULL = "0x0000000000000000000000000000000000000000";
export const NULL32 =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

// Add a 0x prefix to a hex value, converting to a string first
export const Ox = (hex: string | BN | Buffer) => {
    const hexString = typeof hex === "string" ? hex : hex.toString("hex");
    return hexString.substring(0, 2) === "0x" ? hexString : `0x${hexString}`;
};

export const strip0x = (hex: string) =>
    hex.substring(0, 2) === "0x" ? hex.slice(2) : hex;

export const hexToBuffer = (hex: string | BN | Buffer) =>
    BN.isBN(hex)
        ? hex.toBuffer()
        : Buffer.isBuffer(hex)
        ? hex
        : Buffer.from(strip0x(hex), "hex");

export const randomBytes = (bytes: number): string => {
    return Ox(crypto.randomBytes(bytes));
};

export const randomAddress = (): string => {
    return toChecksumAddress(randomBytes(20));
};

const increaseTimeHelper = async (seconds: number) => {
    await new Promise<void>((resolve, reject) => {
        // tslint:disable-next-line: no-floating-promises
        return web3.currentProvider.send(
            {
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [seconds],
                id: 0,
            } as any,
            ((err: Error) => {
                if (err) {
                    reject(err);
                }
                // tslint:disable-next-line: no-floating-promises
                return web3.currentProvider.send(
                    {
                        jsonrpc: "2.0",
                        method: "evm_mine",
                        params: [],
                        id: new Date().getSeconds(),
                    } as any,
                    ((innerErr: Error) => {
                        if (innerErr) {
                            reject();
                        }
                        resolve();
                    }) as any
                );
            }) as any
        );
    });
};

const getCurrentTimestamp = async (): Promise<number> =>
    parseInt(
        (
            await web3.eth.getBlock(await web3.eth.getBlockNumber())
        ).timestamp.toString(),
        10
    );

export const increaseTime = async (seconds: number) => {
    let currentTimestamp = await getCurrentTimestamp();
    const target = currentTimestamp + seconds;
    do {
        const increase = Math.ceil(target - currentTimestamp + 1);
        await increaseTimeHelper(increase);
        currentTimestamp = await getCurrentTimestamp();
    } while (currentTimestamp < target);
};

export async function waitForEpoch(dnr: DarknodeRegistryLogicV3Instance) {
    // const timeout = MINIMUM_EPOCH_INTERVAL_SECONDS;
    const timeout = new BN(
        (await dnr.minimumEpochInterval()).toString()
    ).toNumber();
    while (true) {
        // Must be an on-chain call, or the time won't be updated
        try {
            return await dnr.epoch();
        } catch (err) {
            // epoch reverted, epoch interval hasn't passed
        }
        // Sleep for `timeout` seconds
        await increaseTime(timeout);
        // await new Promise((resolve) => setTimeout(resolve, timeout * 1000));
    }
}

export const deployProxy = async <T>(
    web3: Web3,
    ProxyContract: Truffle.Contract<any>,
    LogicContract: Truffle.Contract<any>,
    proxyGovernanceAddress: string,
    params: { type: string; value: any; name?: string }[],
    options?: { from: string }
): Promise<T> => {
    const logicContract = await LogicContract.new();
    const proxy = await ProxyContract.new();

    await proxy.initialize(
        logicContract.address,
        proxyGovernanceAddress,
        encodeCallData(
            web3,
            "initialize",
            params.map((p) => p.type),
            params.map((p) => p.value)
        ),
        options
    );
    return await LogicContract.at(proxy.address);
};

export const sigToString = (sig: ECDSASignature) => {
    return Ox(
        `${sig.r.toString("hex")}${sig.s.toString("hex")}${sig.v.toString(16)}`
    );
};

export const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

export const HOURS = 60 * 60;
export const DAYS = 24 * HOURS;

export const getBalance = async (
    token: string,
    address: string
): Promise<BigNumber> => {
    if (token === ETHEREUM) {
        return new BigNumber((await web3.eth.getBalance(address)).toString());
    } else {
        const tokenContract = await ERC20.at(token);
        return new BigNumber(
            (await tokenContract.balanceOf(address)).toString()
        );
    }
};

export const getSymbol = async (token: string): Promise<string> => {
    if (token === ETHEREUM) {
        return "ETH";
    } else {
        const tokenContract = await ERC20.at(token);
        return await tokenContract.symbol();
    }
};

export const getDecimals = async (token: string): Promise<number> => {
    if (token === ETHEREUM) {
        return 18;
    } else {
        const tokenContract = await ERC20.at(token);
        return parseInt((await tokenContract.decimals()).toString(), 10);
    }
};

export const transferToken = async (
    token: string,
    to: string,
    amount: BigNumber | string | number | BN
): Promise<TransactionReceipt> => {
    if (token === ETHEREUM) {
        const from = (await web3.eth.getAccounts())[0];
        return (await web3.eth.sendTransaction({
            to,
            value: amount.toString(),
            from,
        })) as unknown as TransactionReceipt;
    } else {
        const tokenContract = await ERC20.at(token);
        return (await tokenContract.transfer(to, amount.toString())).receipt;
    }
};

export const isPromise = <T>(x: any): x is Promise<T> => {
    return !!x.then;
};

export const toBN = <
    X extends (string | number | BN) | Promise<string | number | BN>
>(
    inp: X
): X extends string | number | BN ? BigNumber : Promise<BigNumber> => {
    if (isPromise<string | number | BN>(inp)) {
        return inp.then((x) => new BigNumber(x.toString())) as X extends
            | string
            | number
            | BN
            ? BigNumber
            : Promise<BigNumber>;
    } else {
        return new BigNumber(inp.toString()) as X extends string | number | BN
            ? BigNumber
            : Promise<BigNumber>;
    }
};

export const range = (n: number) => Array.from(new Array(n)).map((_, i) => i);
