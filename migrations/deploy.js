const {
    Contracts
} = require("zos-lib");

const getDeployer = (app) => ({
    deploy: async function deploy(contractName, ...params) {
        const artifact = Contracts.getFromLocal(contractName);
        await app.setImplementation(artifact, contractName);
        return await app.createProxy(artifact, {
            contractName: contractName,
            initMethod: "initialize",
            initArgs: params,
        });
    }
});

async function deployRepublicProtocolContracts(artifacts, app, config) {
    const deployer = getDeployer(app);

    const republicToken = await artifacts.require("RepublicToken").new();

    const darknodeRegistry = await deployer.deploy(
        "DarknodeRegistry",
        config.VERSION,
        republicToken.address,
        config.MINIMUM_BOND,
        config.MINIMUM_POD_SIZE,
        config.MINIMUM_EPOCH_INTERVAL,
        config.CONTRACT_OWNER,
    );

    const settlementRegistry = await deployer.deploy(
        "SettlementRegistry",
        config.VERSION,
        config.CONTRACT_OWNER,
    );

    const orderbook = await deployer.deploy(
        "Orderbook",
        config.VERSION,
        darknodeRegistry.address,
        settlementRegistry.address,
        config.CONTRACT_OWNER,
    );

    const darknodeRewardVault = await deployer.deploy(
        "DarknodeRewardVault",
        config.VERSION,
        darknodeRegistry.address,
        config.CONTRACT_OWNER,
    );

    const darknodeSlasher = await deployer.deploy(
        "DarknodeSlasher",
        config.VERSION,
        darknodeRegistry.address,
        orderbook.address,
        config.CONTRACT_OWNER,
    );

    await darknodeRegistry.updateSlasher(darknodeSlasher.address, {
        from: config.CONTRACT_OWNER
    });

    return {
        republicToken,
        darknodeRegistry,
        settlementRegistry,
        orderbook,
        darknodeRewardVault,
        darknodeSlasher,
    };
}

module.exports = deployRepublicProtocolContracts;