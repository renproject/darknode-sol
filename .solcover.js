module.exports = {
  copyPackages: ['zeppelin-solidity'], // needed to import from node_modules
  testrpcOptions: '-d --accounts 10 --port 8555',
  skipFiles: ['RepublicToken.sol', 'tests/ABCToken.sol', 'tests/XYZToken.sol', 'migrations/Migrations.sol'],
};
