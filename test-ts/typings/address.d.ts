declare namespace Chai {
    // For BDD API
    interface Assertion extends LanguageChains, NumericComparison, TypeComparison {
        address: AssertAddresses;
    }

    interface AssertAddresses {
        equal(expected: string)
    }
}