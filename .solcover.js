module.exports = {
  copyPackages: ['openzeppelin-solidity'], // needed to import from node_modules
  testrpcOptions: '-d --accounts 10 --port 8555',
  skipFiles: [
    'RepublicToken.sol',
    'tests/ABCToken.sol',
    'tests/XYZToken.sol',
    'tests/Reverter.sol',
    'migrations/Migrations.sol'
  ],
};
