import { BigNumber } from "bignumber.js";

declare interface DarkNode {
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

declare interface DarkNodeRegistrarInstance extends Contract<DarkNodeRegistrarInstance> {
  DarkNodeRegistrar(address: string, _minimumBond: number, _minimumEpochInterval: number, options?: any): Promise<void>,
  register(_minerID: string, _publicKey: string, options?: any): Promise<void>,
  deregister(_minerID: string, options?: any): Promise<void>,
  refund(_minerID: string, options?: any): Promise<void>,
  epoch(options?: any): Promise<void>,
  // getDarkNode: { call: (_minerID: string) => Promise<DarkNode> },
  getXingOverlay: { call: () => Promise<DarkNode[]> },
  // getNumberOfMiners: { call: () => Promise<BigNumber> },
  // getNumberOfMinersInEpoch: { call: () => Promise<BigNumber> },
  getOwner: { call: (_minerID: string) => Promise<string> },
  getBond: { call: (_minerID: string) => Promise<BigNumber> },
  getPublicKey: { call: (_minerID: string) => Promise<string> },
  getCommitment: { call: (_minerID: string) => Promise<string> },
  getCurrentEpoch: { call: () => Promise<Epoch> },
}

declare interface TraderRegistrarInstance extends Contract<TraderRegistrarInstance> {
  TraderRegistrar(address: string, _minimumBond: number, options?: any): Promise<void>,
  register(_traderID: string, _publicKey: string, options?: any): Promise<void>,
  deregister(_traderID: string, options?: any): Promise<void>,
  refund(options?: any): Promise<void>,
  getNumberOfTraders: { call: () => Promise<BigNumber> },
  getOwner: { call: (_traderID: string) => Promise<string> },
  getBond: { call: (_traderID: string) => Promise<BigNumber> },
  getPublicKey: { call: (_traderID: string) => Promise<string> },
}
