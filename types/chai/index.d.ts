/* tslint:disable */

/// <reference types="chai" />

declare module "chai-bignumber" {
    function chaiBigNumber(bignumber: any, BN?: any): (chai: any, utils: any) => void;

    namespace chaiBigNumber {
    }

    export = chaiBigNumber;
}

declare namespace Chai {
    type BigNumber = number | string | { toNumber: () => number };

    // For BDD API
    interface Assertion extends LanguageChains, NumericComparison, TypeComparison {
        bignumber: BigNumberAssert;
    }

    // For Assert API
    interface Assert {
        bignumber: BigNumberAssert;
    }

    export interface BigNumberAssert {
        finite<BN extends BigNumber>(actual?: BN, msg?: string): void;
        integer<BN extends BigNumber>(actual?: BN, msg?: string): void;
        negative<BN extends BigNumber>(actual?: BN, msg?: string): void;
        zero<BN extends BigNumber>(actual?: BN, msg?: string): void;

        equal<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;
        equals<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;
        eq<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;

        greaterThan<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;
        above<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;
        gt<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;

        greaterThanOrEqualTo<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;
        least<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;
        gte<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;

        lessThan<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;
        below<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;
        lt<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;

        lessThanOrEqualTo<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;
        most<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;
        lte<BN extends BigNumber>(actual?: BN, expected?: BN, msg?: string): void;
    }
}
