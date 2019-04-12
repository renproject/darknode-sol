module.exports = {
    copyPackages: ["openzeppelin-solidity"], // needed to import from node_modules
    testrpcOptions: "-d --accounts 10 --port 8555",
    skipFiles: [
        // REN token
        "RepublicToken.sol",

        // Contract for building bindings
        "Bindings.sol",

        // Migration contract
        "migrations/Migrations.sol",

        // Contracts for assisting the tests
        "test/CompatibleERC20Test.sol",
        "test/Reverter.sol",
        "test/tokens/ImpreciseToken.sol",
        "test/tokens/NonCompliantToken.sol",
        "test/tokens/NormalToken.sol",
        "test/tokens/ReturnsFalseToken.sol",
        "test/ApprovingBroker.sol",
        "test/DisapprovingBroker.sol",
        "test/SettlementUtilsTest.sol",
        "test/UtilsTest.sol",
        "test/tokens/TokenWithFees.sol",
        "test/LinkedListTest.sol",
        "test/tokens/PaymentToken.sol",
        "test/CycleChanger.sol",
    ],
};