const Web3 = require("web3");

const config = require("./config");
const deployRepublicProtocolContracts = require("./deploy");

module.exports = async function (deployer, network, accounts) {
    ((global)).web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

    const {
        AppProject,
    } = require("zos-lib");

    const project = await AppProject.fetchOrDeploy('republic-sol', config.VERSION, {
        from: accounts[9],
    }, {});

    await deployRepublicProtocolContracts(artifacts, project, {
        ...config,
        CONTRACT_OWNER: accounts[8],
    });
}