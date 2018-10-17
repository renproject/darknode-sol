module.exports = {
  networks: {
    local: {
      host: "localhost",
      port: 9545,
      network_id: "*",
      gas: 5000000
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