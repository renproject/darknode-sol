import * as Big from "bignumber.js";
import { BN } from "bn.js";

export default class BigNumber extends Big.BigNumber {
    constructor(n: Big.BigNumber.Value | BN, base?: number);
}