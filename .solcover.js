module.exports = {
    copyPackages: ["openzeppelin-solidity"], // needed to import from node_modules
    testrpcOptions: "-d --accounts 10 --port 8555",
    skipFiles: [
        // REN token
        "RenToken/RenToken.sol",

        // Contract for building bindings
        "test/Bindings.sol",

        // Migration contract
        "migrations/Migrations.sol",

        // Contracts for assisting the tests
        "test/CompatibleERC20Test.sol",
        "test/tokens/ImpreciseToken.sol",
        "test/tokens/SelfDestructingToken.sol",
        "test/tokens/NonCompliantToken.sol",
        "test/tokens/NormalToken.sol",
        "test/tokens/ReturnsFalseToken.sol",
        "test/tokens/TokenWithFees.sol",
        "test/LinkedListTest.sol",
        "test/StringTest.sol",
        "test/tokens/PaymentToken.sol",
        "test/CycleChanger.sol",
    ],
};