module.exports = {
    copyPackages: ["@openzeppelin/contracts-ethereum-package"], // needed to import from node_modules.
    testrpcOptions: "-d --accounts 10 --port 8555",
    skipFiles: [
        // REN token.
        "RenToken/RenToken.sol",

        // Contract for building bindings.
        "test/Bindings.sol",

        // Migration contract.
        "migrations/Migrations.sol",

        // Examples
        "Gateway/adapters/BasicAdapter.sol",
        "Gateway/examples/Vesting.sol",

        // Contracts for assisting the tests.
        "test/ERC20WithFeesTest.sol",
        "test/tokens/ImpreciseToken.sol",
        "test/tokens/SelfDestructingToken.sol",
        "test/tokens/NonCompliantToken.sol",
        "test/tokens/NormalToken.sol",
        "test/tokens/ReturnsFalseToken.sol",
        "test/tokens/TokenWithFees.sol",
        "test/LinkedListTest.sol",
        "test/ValidateTest.sol",
        "test/StringTest.sol",
        "test/CompareTest.sol",
        "test/tokens/PaymentToken.sol",
        "test/CycleChanger.sol"
    ]
};
