import * as chai from "chai";

import BigNumber from "bignumber.js";
import BN from "bn.js";

interface Log {
    event: string;
    args: object;
}

interface TransactionReceipt {
    tx: string;
    receipt: {
        transactionHash: string,
        transactionIndex: number,
        blockHash: string,
        blockNumber: number,
        gasUsed: number,
        cumulativeGasUsed: number,
        contractAddress: null,
        logs: any[],
        status: boolean,
        logsBloom: string,
    };
    logs: {
        logIndex: number,
        transactionIndex: number,
        transactionHash: string,
        blockHash: string,
        blockNumber: number,
        address: string,
        type: string,
        id: string,
        event: string,
        args: object,
    }[];
}

export const log = (event: string, args: object) => ({
    event,
    args,
});

// Chai helper for comparing logs
// tslint:disable:only-arrow-functions
chai.use(function (newChai: any, utils: any): void {
    const property = "emit";
    newChai.Assertion.addProperty(property, function () {
        utils.flag(this, property, true);
    });

    const override = function (fn: any) {
        // tslint:disable-next-line:variable-name
        return function (_super: any) {
            return function (value: any, ...args: any[]) {
                if (utils.flag(this, property)) {
                    const expected = value;
                    const actual = getLogsFromTx(this._obj);
                    fn.apply(this, [expected, actual]);
                } else {
                    _super.apply(this, [value, ...args]);
                }
            };
        };
    };

    const events = override(function (expected: Log[], actual: Log[]) {
        this.assert(
            compareArrayOfLogs(expected, actual),
            "expected logs #{act} to equal #{exp}",
            "expected logs #{act} to be different from #{exp}",
            logsToString(expected),
            logsToString(actual),
        );

        for (let i = 0; i < expected.length; i++) {
            const expectedLog = expected[i];
            const actualLog = actual[i];
            for (const arg in expectedLog.args) {
                // skip if the property is from prototype
                if (!expectedLog.args.hasOwnProperty(arg)) { continue; }

                const expectedArg = (expectedLog.args as any)[arg];
                const actualArg = (actualLog.args as any)[arg];

                let sameValues: boolean;
                if (BN.isBN(expectedArg) || expectedArg.isBigNumber) {
                    sameValues = (new BigNumber(expectedArg).eq(new BigNumber(actualArg)));
                } else {
                    sameValues = (expectedArg === (actualLog.args as any)[arg]);
                }

                this.assert(
                    sameValues,
                    `expected ${arg} to be #{exp} instead of #{act} in log ${expectedLog.event}`,
                    `expected ${arg} to be different from #{exp} in log ${expectedLog.event}`,
                    (expectedLog.args as any)[arg],
                    (actualLog.args as any)[arg],
                );
            }
        }
    });
    newChai.Assertion.overwriteMethod("logs", events);
});

// Pretty-print logs
const logsToString = (logs: Log[]): string => {
    return `[${logs.map((logItem: Log) => logItem.event).join(", ")}]`;
};
// const logToString = (logItem: Log): string => {
//     return `${logItem.event} ${JSON.stringify(logItem.args)}`;
// };

// Compare logs
const compareArrayOfLogs = (expected: Log[], actual: Log[]): boolean => {
    if (expected.length !== actual.length) { return false; }

    for (let i = 0; i < expected.length; i++) {
        const expectedLog = expected[i];
        const actualLog = actual[i];

        if (expectedLog.event !== actualLog.event) { return false; }
    }

    return true;
};

// Extract logs from transaction receipt in correct format.s
export const getLogsFromTx = (tx: TransactionReceipt): Log[] => {
    return tx.logs.map((logItem) => {
        const args = {};
        for (const arg in logItem.args) {
            // skip if the property is from prototype
            if (!logItem.args.hasOwnProperty(arg)) { continue; }

            if (isNaN(parseInt(arg, 10)) && arg !== "__length__") {
                (args as any)[arg] = (logItem.args as any)[arg];
            }
        }
        return {
            event: logItem.event,
            args,
        };
    });
};
