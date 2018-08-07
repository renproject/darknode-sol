import { TransactionObject, Tx } from "web3/types";
import { BN } from "bn.js";

// tslint:disable:max-line-length
export interface DarknodeRewardVaultContract {
    darknodeBalances(index_0: string, index_1: string, options?: Tx): Promise<number|string|BN>;
    renounceOwnership(options?: Tx): Promise<TransactionObject<void>>;
    owner(options?: Tx): Promise<string>;
    darknodeRegistry(options?: Tx): Promise<string>;
    transferOwnership(_newOwner: string, options?: Tx): Promise<TransactionObject<void>>;
    ETHEREUM(options?: Tx): Promise<string>;
    updateDarknodeRegistry(_newDarknodeRegistry: string, options?: Tx): Promise<TransactionObject<void>>;
    deposit(_darknode: string, _token: string, _value: number|string|BN, options?: Tx): Promise<TransactionObject<void>>;
    withdraw(_darknode: string, _token: string, options?: Tx): Promise<TransactionObject<void>>;
    address: string;
}
// tslint:enable:max-line-length
