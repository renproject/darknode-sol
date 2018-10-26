const config = require("./config");
const deployRepublicProtocolContracts = require("./deploy");

const fixWeb3 = require("./fixWeb3");

module.exports = async function (deployer, network, accounts) {
    fixWeb3(web3, artifacts);

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

    // global.web3 = previousWeb3;
}