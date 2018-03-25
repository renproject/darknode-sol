module.exports = {
  testrpcOptions: '-d --gasLimit 0xfffffffffff --accounts 35 --port 8555',
  // skipFiles: ['RepublicToken.sol', 'Ownable.sol', 'DarkNodeRegistrar.sol', 'TraderRegistrar.sol', 'Gateway.sol', 'LinkedList.sol', 'Migrations.sol', 'Utils.sol', 'LinkedListTest.sol'],
  skipFiles: ['RepublicToken.sol', 'TraderRegistrar.sol', 'migrations/Migrations.sol'],
  port: 8555,
};
