module.exports = {
  networks: {
    local: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 6721975,
      gasPrice: 10000000000,
    },
  },
  mocha: {
    // // Use with `truffle develop`, not with `npm run coverage`
    // reporter: 'eth-gas-reporter',
    // reporterOptions: {
    //   currency: 'USD',
    //   gasPrice: 21
    // },
    enableTimeouts: false,
    useColors: true,
    bail: true,
  },
};