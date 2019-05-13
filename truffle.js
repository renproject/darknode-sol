require("ts-node/register");
require("dotenv").config();

const HDWalletProvider = require("truffle-hdwallet-provider");

const GWEI = 1000000000;

module.exports = {
  networks: {
    kovan: {
      // @ts-ignore
      provider: () => new HDWalletProvider(process.env.MNEMONIC_KOVAN, `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`),
      network_id: 42,
      gas: 6721975,
      gasPrice: 6.5 * GWEI,
    },
    mainnet: {
      // @ts-ignore
      provider: () => new HDWalletProvider(process.env.MNEMONIC_MAINNET, `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`),
      network_id: 1,
      gas: 6721975,
      gasPrice: 6.5 * GWEI,
    },
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*",
    },
  },
  mocha: {
    // // Use with `npm run test`, not with `npm run coverage`
    // reporter: 'eth-gas-reporter',
    // reporterOptions: {
    //   currency: 'USD',
    //   gasPrice: 21
    // },
    enableTimeouts: false,
    useColors: true,
    bail: true,
  },
  compilers: {
    solc: {
      version: "0.5.8",
      settings: {
        evmVersion: "petersburg",
        optimizer: {
          enabled: true,
          runs: 200,
        }
      }
    }
  },
  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    etherscan: process.env.ETHERSCAN_KEY,
  },
  contracts_build_directory: "./build/contracts",
  flattenedLocation: "./.merged",
  // This is required by truffle to find any ts test files
  test_file_extension_regexp: /.*\.ts$/
};
