const {
    Contracts
} = require("zos-lib");

async function deploy(app, version, contractOwner) {
    const SettlementRegistry = Contracts.getFromLocal("SettlementRegistry");
    await app.setImplementation(SettlementRegistry, "SettlementRegistry");
    const settlementRegistry = await app.createProxy(SettlementRegistry, {
        contractName: "SettlementRegistry",
        initMethod: "initialize",
        initArgs: [version, contractOwner],
    });

    return {
        settlementRegistry,
    };
}

module.exports = deploy;