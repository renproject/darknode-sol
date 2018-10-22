import * as chai from "chai";

import BigNumber from "bignumber.js";

export interface Log {
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
    logs: Array<{
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
    }>;
}

// Chai helper for comparing logs
// tslint:disable:only-arrow-functions
chai.use(function (newChai: any, utils: any): void {
    const property = "emit";
    newChai.Assertion.addProperty(property, function () {
        utils.flag(this, property, true);
    });

    const override = function (fn) {
        // tslint:disable-next-line:variable-name
        return function (_super) {
            return function (value, ...args) {
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

                let expectedArg = expectedLog.args[arg];
                let actualArg = actualLog.args[arg];

                if (typeof (expectedArg) === "string") {
                    expectedArg = expectedArg.toLowerCase();
                }

                if (typeof (actualArg) === "string") {
                    actualArg = actualArg.toLowerCase();
                }

                const comparison = (new BigNumber(expectedArg).eq(new BigNumber(actualArg)));

                this.assert(
                    comparison,
                    `expected ${arg} to be #{exp} instead of #{act} in log ${expectedLog.event}`,
                    `expected ${arg} to be different from #{exp} in log ${expectedLog.event}`,
                    expectedLog.args[arg].toString(),
                    actualLog.args[arg].toString(),
                );
            }
        }
    });
    newChai.Assertion.overwriteMethod("logs", events);
});

// Pretty-print logs
const logsToString = (logs: Log[]): string => {
    return `[${logs.map((log: Log) => log.event).join(", ")}]`;
};
const logToString = (log: Log): string => {
    return `${log.event} ${JSON.stringify(log.args)}`;
};

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
    return tx.logs.map((log) => {
        const args = {};
        for (const arg in log.args) {
            // skip if the property is from prototype
            if (!log.args.hasOwnProperty(arg)) { continue; }

            if (isNaN(parseInt(arg, 10)) && arg !== "__length__") {
                args[arg] = log.args[arg];
            }
        }
        return {
            event: log.event,
            args,
        };
    });
};
