// var RepublicToken = artifacts.require("RepublicToken.sol");
// var DarknodeRegistry = artifacts.require("DarknodeRegistry.sol");
// var Orderbook = artifacts.require("Orderbook.sol");
// var DarknodeRewardVault = artifacts.require("DarknodeRewardVault.sol");

// const BOND = 100000 * 1e18;
// const INGRESS_FEE = 0;
// let POD_SIZE = 3; // 24 in production
// let EPOCH_BLOCKS = 1; // 14400 in production

// module.exports = async function (deployer, network) {
//     await deployer
//         .deploy(
//             RepublicToken, { overwrite: network !== "f0" }
//         )
//         .then(() => deployer.deploy(
//             DarknodeRegistry,
//             RepublicToken.address,
//             BOND,
//             POD_SIZE,
//             EPOCH_BLOCKS,
//         ))

//         .then(() => deployer.deploy(
//             Orderbook,
//             INGRESS_FEE,
//             RepublicToken.address,
//             DarknodeRegistry.address,
//         ))

//         .then(() => deployer.deploy(
//             DarknodeRewardVault, DarknodeRegistry.address
//         ));
// };

module.exports = async function (deployer, network) {
    //
}