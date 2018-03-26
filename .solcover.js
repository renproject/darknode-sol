module.exports = {
  testrpcOptions: '-d --gasLimit 0xfffffffffff --accounts 10 --port 8555',
  // skipFiles: ['RepublicToken.sol', 'Ownable.sol', 'DarkNodeRegistry.sol', 'TraderRegistry.sol', 'Gateway.sol', 'LinkedList.sol', 'Migrations.sol', 'Utils.sol', 'LinkedListTest.sol'],
  skipFiles: ['RepublicToken.sol', 'TraderRegistry.sol', 'migrations/Migrations.sol'],
  port: 8555,
};
