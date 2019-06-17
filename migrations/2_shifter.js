/// <reference types="../types/truffle-contracts" />

const BTCShifter = artifacts.require("BTCShifter");
const zBTC = artifacts.require("zBTC");

const ZECShifter = artifacts.require("ZECShifter");
const zZEC = artifacts.require("zZEC");

const DarknodePayment = artifacts.require("DarknodePayment");

const networks = require("./networks.js");

module.exports = async function (deployer, network, accounts) {
    deployer.logger.log(`Deploying to ${network}...`);

    const addresses = networks[network] || {};
    const config = networks[network] ? networks[network].config : networks.config;
    const _mintAuthority = config.owner || accounts[0];
    // TODO: _feeRecipient should be the DarknodePayment contract
    // There should be a 0_darknode_payment.js that deploys it before the shifter contracts
    const _feeRecipient = addresses.DarknodePayment || accounts[0];

    BTCShifter.address = addresses.BTCShifter || "";
    ZECShifter.address = addresses.ZECShifter || "";
    zZEC.address = addresses.zZEC || "";
    zBTC.address = addresses.zBTC || "";

    const darknodePayment = await DarknodePayment.at(DarknodePayment.address);

    /** BTC *******************************************************************/

    if (!zBTC.address) {
        await deployer.deploy(zBTC, "Shifted Bitcoin", "zBTC", 8);
    }
    const zbtc = await zBTC.at(zBTC.address);

    if (!BTCShifter.address) {
        await deployer.deploy(
            BTCShifter,
            "0x0000000000000000000000000000000000000000",
            zBTC.address,
            _feeRecipient,
            _mintAuthority,
            config.shifterFees,
        );
    }
    const btcShifter = await BTCShifter.at(BTCShifter.address);

    if (await zbtc.owner() !== BTCShifter.address) {
        await zbtc.transferOwnership(BTCShifter.address);
        await btcShifter.claimTokenOwnership();
    }

    const zBTCRegistered = await darknodePayment.registeredTokenIndex(zBTC.address);
    if (zBTCRegistered.toString() === "0") {
        deployer.logger.log(`Registering token zBTC in DarknodePayment`);
        await darknodePayment.registerToken(zBTC.address);
    }

    /** ZEC *******************************************************************/

    if (!zZEC.address) {
        await deployer.deploy(zZEC, "Shifted ZCash", "zZEC", 8);
    }
    const zzec = await zZEC.at(zZEC.address);

    if (!ZECShifter.address) {
        await deployer.deploy(
            ZECShifter,
            "0x0000000000000000000000000000000000000000",
            zZEC.address,
            _feeRecipient,
            _mintAuthority,
            config.shifterFees,
        );
    }
    const zecShifter = await ZECShifter.at(ZECShifter.address);

    if (await zzec.owner() !== ZECShifter.address) {
        await zzec.transferOwnership(ZECShifter.address);
        await zecShifter.claimTokenOwnership();
    }

    const zZECRegistered = await darknodePayment.registeredTokenIndex(zZEC.address);
    if (zZECRegistered.toString() === "0") {
        deployer.logger.log(`Registering token zZEC in DarknodePayment`);
        await darknodePayment.registerToken(zZEC.address);
    }


    /** LOG *******************************************************************/

    console.log({
        BTCShifter: BTCShifter.address,
        ZECShifter: ZECShifter.address,
        zBTC: zBTC.address,
        zZEC: zZEC.address,
    });
}