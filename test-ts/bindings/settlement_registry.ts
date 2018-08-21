import { Tx, TransactionReceipt, Log } from "web3/types";
import { BN } from "bn.js";

export interface Transaction { receipt: TransactionReceipt; tx: string; logs: Log[]; }

// tslint:disable:max-line-length
export interface SettlementRegistryContract {
    renounceOwnership(options?: Tx): Promise<Transaction>;
    owner(options?: Tx): Promise<string>;
    transferOwnership(_newOwner: string, options?: Tx): Promise<Transaction>;
    settlementDetails(index_0: number|string|BN, options?: Tx): Promise<[boolean, string, string]>;
    settlementRegistration(_settlementID: number|string|BN, options?: Tx): Promise<boolean>;
    settlementContract(_settlementID: number|string|BN, options?: Tx): Promise<string>;
    brokerVerifierContract(_settlementID: number|string|BN, options?: Tx): Promise<string>;
    registerSettlement(_settlementID: number|string|BN, _settlementContract: string, _brokerVerifierContract: string, options?: Tx): Promise<Transaction>;
    deregisterSettlement(_settlementID: number|string|BN, options?: Tx): Promise<Transaction>;
    address: string;
}
// tslint:enable:max-line-length
