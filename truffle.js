require("ts-node/register");
require("dotenv").config();

const HDWalletProvider = require("truffle-hdwallet-provider");
const { execSync } = require("child_process");

const GWEI = 1000000000;
const commitHash = execSync("git describe --always --long")
    .toString()
    .trim();

if (
    (process.env.NETWORK || "").match(/localnet|devnet|testnet|main/) &&
    process.env.INFURA_KEY === undefined
) {
    throw new Error("Must set INFURA_KEY");
}

const kovanNetwork = {
    // @ts-ignore
    provider: () =>
        new HDWalletProvider(
            process.env.MNEMONIC_KOVAN,
            `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`
        ),
    network_id: 42,
    gas: 6721975,
    gasPrice: 6.5 * GWEI
};

const mainNetwork = {
    // @ts-ignore
    provider: () =>
        new HDWalletProvider(
            process.env.MNEMONIC_MAINNET,
            `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`
        ),
    network_id: 1,
    gas: 8721975,
    gasPrice: 18 * GWEI,
    networkCheckTimeout: 10000
};

const ethRinkebyNetwork = {
    // @ts-ignore
    provider: () =>
        new HDWalletProvider(
            process.env.MNEMONIC_TESTNET || process.env.MNEMONIC_KOVAN,
            `https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`
        ),
    network_id: 4,
    // gas: 6721975,
    // gasPrice: 6.5 * GWEI,
    networkCheckTimeout: 10000
};

module.exports = {
    networks: {
        localnet: kovanNetwork,
        devnet: kovanNetwork,
        rinkebyDevnet: ethRinkebyNetwork,
        testnet: kovanNetwork,
        mainnet: mainNetwork,
        chaosnet: mainNetwork,
        development: {
            host: "localhost",
            port: 8545,
            network_id: "*"
        }
    },
    mocha: {
        // // Use with `npm run test`, not with `npm run coverage`
        // reporter: "eth-gas-reporter",
        // reporterOptions: {
        //   currency: 'USD',
        //   gasPrice: 21
        // },
        enableTimeouts: false,
        useColors: true,
        bail: false
    },
    compilers: {
        solc: {
            version: "0.5.17",
            settings: {
                // evmVersion: "petersburg", // "istanbul",
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        }
    },
    plugins: ["truffle-plugin-verify", "solidity-coverage"],
    api_keys: {
        etherscan: process.env.ETHERSCAN_KEY
    },
    verify: {
        preamble: `
Deployed by Ren Project, https://renproject.io

Commit hash: ${commitHash}
Repository: https://github.com/renproject/darknode-sol
Issues: https://github.com/renproject/darknode-sol/issues

Licenses
@openzeppelin/contracts: (MIT) https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/LICENSE
darknode-sol: (GNU GPL V3) https://github.com/renproject/darknode-sol/blob/master/LICENSE
`
    },
    contracts_build_directory: `./build/${process.env.NETWORK ||
        "development"}`,
    // This is required by truffle to find any ts test files
    test_file_extension_regexp: /.*\.ts$/
};
