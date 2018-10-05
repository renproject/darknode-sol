module.exports = {
    copyPackages: ["openzeppelin-solidity"], // needed to import from node_modules
    testrpcOptions: "-d --accounts 10 --port 8555",
    skipFiles: [
        "RepublicToken.sol",
        "migrations/Migrations.sol",
        "test/CompatibleERC20Test.sol",
        "test/Reverter.sol",
        "test/tokens/ImpreciseToken.sol",
        "test/tokens/NonCompliantToken.sol",
        "test/tokens/NormalToken.sol",
        "test/tokens/ReturnsFalseToken.sol",
    ],
};