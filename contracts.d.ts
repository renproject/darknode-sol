import { BigNumber } from "bignumber.js";

declare interface Miner {
  owner: string;
  bond: number;
  publicKey: string;
  commitment: string;
  registered: boolean;
  registeredAt: number;
  registeredPosition: number;
}

declare interface Epoch {
  blockhash: string
  timestamp: number,
}

declare interface MinerRegistrarInstance {
  MinerRegistrar(address: string, _minimumBond: number, _minimumEpochInterval: number): Promise<void>,
  register(_minerID: string, _publicKey: string): Promise<void>,
  deregister(_minerID: string): Promise<void>,
  refund(): Promise<void>,
  epoch(): Promise<void>,
  getMiner: { call: (_minerID: string) => Promise<Miner> },
  getMiners: { call: (_offset: number, _limit: number) => Promise<Miner[]> },
  getNumberOfMiners: { call: () => Promise<BigNumber> },
  getNumberOfMinersInEpoch: { call: () => Promise<BigNumber> },
  getOwner: { call: (_minerID: string) => Promise<string> },
  getBond: { call: (_minerID: string) => Promise<BigNumber> },
  getPublicKey: { call: (_minerID: string) => Promise<string> },
  getCommitment: { call: (_minerID: string) => Promise<string> },
  getCurrentEpoch: { call: () => Promise<Epoch> },
}
