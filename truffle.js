require('dotenv').config()

var HDWalletProvider = require("truffle-hdwallet-provider");

console.log(process.env.MNEMONIC);

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*",
    },
    ropsten: {
      provider: function () {
        return new HDWalletProvider(process.env.MNEMONIC, `https://ropsten.infura.io/${process.env.INFURA_TOKEN}`);
      },
      network_id: 3,
      gas: 3000000,
    },
    kovan: {
      // provider: function () {
      //   return new HDWalletProvider("***REMOVED***", `https://kovan.infura.io/${process.env.INFURA_TOKEN}`);
      // },
      network_id: 42,
      gas: 3000000,
    },
  },
  mocha: {
    // // Use with `truffle develop`, not with `npm run coverage`
    // reporter: 'eth-gas-reporter',
    // reporterOptions: {
    //   currency: 'USD',
    //   gasPrice: 21
    // },
    bail: true,
  },
};
