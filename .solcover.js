module.exports = {
  copyNodeModules: true, // needed to import from node_modules
  testrpcOptions: '-d --accounts 10 --port 8555',
  skipFiles: ['RepublicToken.sol', 'TraderRegistry.sol', 'migrations/Migrations.sol'],
};
