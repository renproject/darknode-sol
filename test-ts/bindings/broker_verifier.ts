import { Tx, TransactionReceipt, Log } from "web3/types";
import { BN } from "bn.js";

export interface Transaction { receipt: TransactionReceipt; tx: string; logs: Log[]; }

// tslint:disable:max-line-length
export interface BrokerVerifierContract {
    verifyOpenSignature(_trader: string, _signature: string, _orderID: string, options?: Tx): Promise<Transaction>;
    address: string;
}
// tslint:enable:max-line-length
