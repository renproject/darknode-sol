module.exports = {
  // testrpcOptions: '-d --gasLimit 0xfffffffffff --accounts 35 --port 8555',
  testCommand: '$(./ganache 35) && truffle test',
  skipFiles: ['RepublicToken.sol'],
  port: 8545,
  norpc: true,
};
