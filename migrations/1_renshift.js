/// <reference types="../types/truffle-contracts" />

const RenShift = artifacts.require("RenShift");
const zBTC = artifacts.require("zBTC");
const zZEC = artifacts.require("zZEC");

const networks = require("./networks.js");

module.exports = async function (deployer, network, accounts) {
    deployer.logger.log(`Deploying to ${network}...`);

    const addresses = networks[network] || {};
    const tokens = addresses.tokens || {};
    const config = networks[network] ? networks[network].config : networks.config;
    const owner = config.owner || web3.eth.accounts.create();

    RenShift.address = addresses.RenShift || "";
    zZEC.address = tokens.zZEC || "";
    zBTC.address = tokens.zBTC || "";

    /** RenShift **************************************************************/

    if (!RenShift.address) {
        await deployer.deploy(
            RenShift,
            config.owner, // address _owner
            config.vault || accounts[0], // address _vault
            config.renShiftFees, // uint16 _fee
        );
    }
    const renShift = await RenShift.at(RenShift.address);

    if (!zBTC.address) {
        await renShift.newShiftedToken("Shifted Bitcoin", "zBTC", 8);
        zBTC.address = await renShift.shiftedTokens("zBTC");
        console.log(`[BTC]: ${zBTC.address}`);
    }

    if (!zZEC.address) {
        await renShift.newShiftedToken("Shifted ZCash", "zZEC", 8);
        zZEC.address = await renShift.shiftedTokens("zZEC");
        console.log(`[ZEC]: ${zZEC.address}`);
    }

    console.log({
        RenShift: RenShift.address,
        tokens: {
            zBTC: zBTC.address,
            zZEC: zZEC.address,
        }
    });
}