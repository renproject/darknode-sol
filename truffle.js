module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*"
    },
  },
  mocha: {
    // // Use with `truffle develop`, not with `npm run coverage`
    // reporter: 'eth-gas-reporter',
    // reporterOptions: {
    //   currency: 'USD',
    //   gasPrice: 21
    // },
    bail: true
  }
};
