module.exports = {
  copyPackages: ['openzeppelin-solidity'], // needed to import from node_modules
  testrpcOptions: '-d --accounts 10 --port 8555',
  skipFiles: [
    'RepublicToken.sol',
    'tests/ABCToken.sol',
    'tests/XYZToken.sol',
    'tests/DGXMock.sol',
    'tests/WithdrawalBlock.sol',
    'tests/Reverter.sol',
    'tests/BitcoinMock.sol',
    'migrations/Migrations.sol'
  ],
};
