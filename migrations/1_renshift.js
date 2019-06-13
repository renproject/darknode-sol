/// <reference types="../types/truffle-contracts" />

const Shifter = artifacts.require("Shifter");
const zBTC = artifacts.require("zBTC");
const zZEC = artifacts.require("zZEC");

const networks = require("./networks.js");

module.exports = async function (deployer, network, accounts) {
    deployer.logger.log(`Deploying to ${network}...`);

    const addresses = networks[network] || {};
    const tokens = addresses.tokens || {};
    const config = networks[network] ? networks[network].config : networks.config;
    const owner = config.owner || web3.eth.accounts.create();

    Shifter.address = addresses.Shifter || "";
    zZEC.address = tokens.zZEC || "";
    zBTC.address = tokens.zBTC || "";

    /** Shifter **************************************************************/

    if (!Shifter.address) {
        await deployer.deploy(
            Shifter,
            config.owner, // address _owner
            config.vault || accounts[0], // address _vault
            config.shifterFees, // uint16 _fee
        );
    }
    const shifter = await Shifter.at(Shifter.address);

    if (!zBTC.address) {
        await shifter.newShiftedToken("Shifted Bitcoin", "zBTC", 8);
        zBTC.address = await shifter.shiftedTokens("zBTC");
        console.log(`[BTC]: ${zBTC.address}`);
    }

    if (!zZEC.address) {
        await shifter.newShiftedToken("Shifted ZCash", "zZEC", 8);
        zZEC.address = await shifter.shiftedTokens("zZEC");
        console.log(`[ZEC]: ${zZEC.address}`);
    }

    console.log({
        Shifter: Shifter.address,
        tokens: {
            zBTC: zBTC.address,
            zZEC: zZEC.address,
        }
    });
}