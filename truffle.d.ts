// Borrowed from https://github.com/biern/truffle-typescript-example (No License)

// import * as Web3 from "web3";

declare type _contractTest = (accounts: string[]) => void;
declare function contract(name: string, test: _contractTest): void;
declare interface TransactionMeta {
  from: string,
}

declare interface Contract<T> {
  "new"(): Promise<T>,
  deployed(): Promise<T>,
  at(address: string): T,
}

interface Artifacts {
  require(name: string): Contract<any>,
}

declare var artifacts: Artifacts;
declare var web3: any;
declare var assert: any; // Fix