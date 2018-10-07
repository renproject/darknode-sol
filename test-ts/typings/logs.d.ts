interface Log {
    event: string;
    args: object;
}

declare namespace Chai {
    // For BDD API
    interface Assertion extends LanguageChains, NumericComparison, TypeComparison {
        emit: AssertLogs;
    }

    interface AssertLogs {
        logs(expected: Log[])
    }
}