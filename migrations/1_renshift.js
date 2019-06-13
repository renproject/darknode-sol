/// <reference types="../types/truffle-contracts" />

const BTCShifter = artifacts.require("BTCShifter");
const zBTC = artifacts.require("zBTC");

const ZECShifter = artifacts.require("ZECShifter");
const zZEC = artifacts.require("zZEC");

const networks = require("./networks.js");

module.exports = async function (deployer, network, accounts) {
    deployer.logger.log(`Deploying to ${network}...`);

    const addresses = networks[network] || {};
    const tokens = addresses.tokens || {};
    const config = networks[network] ? networks[network].config : networks.config;
    const _mintAuthority = config.owner || web3.eth.accounts.create();
    const _feeAuthority = config.vault || accounts[0];

    BTCShifter.address = addresses.BTCShifter || "";
    ZECShifter.address = addresses.ZECShifter || "";
    zZEC.address = addresses.zZEC || "";
    zBTC.address = addresses.zBTC || "";

    /** BTC *******************************************************************/

    if (!zBTC.address) {
        await deployer.deploy(zBTC, "Shifted Bitcoin", "zBTC", 8);
    }
    const zbtc = await zBTC.at(zBTC.address);

    if (!BTCShifter.address) {
        await deployer.deploy(
            BTCShifter,
            owner, // address _owner
            config.vault || accounts[0], // address _vault
            config.shifterFees, // uint16 _fee
        );
    }
    const btcShifter = await BTCShifter.at(BTCShifter.address);

    if (await zbtc.owner() !== BTCShifter.address) {
        await zbtc.transferOwnership(BTCShifter.address);
        await btcShifter.claimOwnership();
    }


    /** ZEC *******************************************************************/

    if (!zZEC.address) {
        await deployer.deploy(zZEC, "Shifted ZCash", "zZEC", 8);
    }
    const zzec = await zZEC.at(zZEC.address);

    if (!ZECShifter.address) {
        await deployer.deploy(
            ZECShifter,
            zZEC.address,
            _feeRecipient, // address _owner
            _mintAuthority, // address _vault
            _fee, // uint16 _fee
        );
    }
    const zecShifter = await ZECShifter.at(ZECShifter.address);

    if (await zzec.owner() !== ZECShifter.address) {
        await zzec.transferOwnership(ZECShifter.address);
        await zecShifter.claimOwnership();
    }


    /** LOG *******************************************************************/

    console.log({
        BTCShifter: BTCShifter.address,
        ZECShifter: ZECShifter.address,
        zBTC: zBTC.address,
        zZEC: zZEC.address,
    });
}