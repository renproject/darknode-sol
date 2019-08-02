/// <reference types="../types/truffle-contracts" />

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * @param {string} question
 */
function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, (input) => resolve(input));
    });
}

const NULL = "0x0000000000000000000000000000000000000000";

const ShifterRegistry = artifacts.require("ShifterRegistry");

const BTCShifter = artifacts.require("BTCShifter");
const zBTC = artifacts.require("zBTC");

const ZECShifter = artifacts.require("ZECShifter");
const zZEC = artifacts.require("zZEC");

const DarknodePayment = artifacts.require("DarknodePayment");

const networks = require("./networks.js");

/**
 * @param {any} deployer
 * @param {string} network
 * @param {any[]} accounts
 */
module.exports = async function (deployer, network, accounts) {
    deployer.logger.log(`Deploying to ${network} (${network.replace("-fork", "")})...`);

    network = network.replace("-fork", "");

    const addresses = networks[network] || {};
    const config = networks[network] ? networks[network].config : networks.config;
    const _mintAuthority = config.mintAuthority || accounts[0];
    // TODO: _feeRecipient should be the DarknodePayment contract
    // There should be a 0_darknode_payment.js that deploys it before the shifter contracts
    const _feeRecipient = addresses.DarknodePaymentStore || accounts[0];

    BTCShifter.address = addresses.BTCShifter || "";
    ZECShifter.address = addresses.ZECShifter || "";
    ShifterRegistry.address = addresses.ShifterRegistry || "";
    zZEC.address = addresses.zZEC || "";
    zBTC.address = addresses.zBTC || "";

    if (network.match(/localnet|devnet|testnet|main/)) {
        await ask(`\n\nUsing DarknodePayment at ${DarknodePayment.address}. Press any key to continue.`);
    }

    const darknodePayment = await DarknodePayment.at(DarknodePayment.address);

    /** Registry **************************************************************/

    if (!ShifterRegistry.address) {
        await deployer.deploy(
            ShifterRegistry,
        );
    }
    const registry = await ShifterRegistry.at(ShifterRegistry.address);

    /** BTC *******************************************************************/

    if (!zBTC.address) {
        await deployer.deploy(zBTC, "Shifted Bitcoin", "zBTC", 8);
    }
    const zbtc = await zBTC.at(zBTC.address);

    if (!BTCShifter.address) {
        await deployer.deploy(
            BTCShifter,
            zBTC.address,
            _feeRecipient,
            _mintAuthority,
            config.shifterFees,
            config.zBTCMinShiftOutAmount,
        );
    }
    const btcShifter = await BTCShifter.at(BTCShifter.address);

    if (await zbtc.owner() !== BTCShifter.address) {
        await zbtc.transferOwnership(BTCShifter.address);
        await btcShifter.claimTokenOwnership();
    }

    // Try to change the payment cycle in case the token is pending registration
    let zBTCRegistered = await darknodePayment.registeredTokenIndex(zBTC.address);
    if (zBTCRegistered.toString() === "0") {
        try {
            deployer.logger.log("Attempting to change cycle");
            await darknodePayment.changeCycle();
        } catch (error) {
            deployer.logger.log("Unable to call darknodePayment.changeCycle()");
        }
    }

    zBTCRegistered = await darknodePayment.registeredTokenIndex(zBTC.address);
    if (zBTCRegistered.toString() === "0") {
        deployer.logger.log(`Registering token zBTC in DarknodePayment`);
        await darknodePayment.registerToken(zBTC.address);
    }

    if ((await registry.getShifterByToken(zBTC.address)) === NULL) {
        deployer.logger.log(`Registering BTC shifter`);
        await registry.setShifter(zBTC.address, BTCShifter.address);
    } else {
        deployer.logger.log(`BTC shifter is already registered: ${await registry.getShifterByToken(zBTC.address)}`);
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
            _feeRecipient,
            _mintAuthority,
            config.shifterFees,
            config.zZECMinShiftOutAmount,
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

    if ((await registry.getShifterByToken(zZEC.address)) === NULL) {
        deployer.logger.log(`Registering ZEC shifter`);
        await registry.setShifter(zZEC.address, ZECShifter.address);
    } else {
        deployer.logger.log(`ZEC shifter is already registered: ${await registry.getShifterByToken(zZEC.address)}`);
    }


    /** LOG *******************************************************************/

    deployer.logger.log({
        BTCShifter: BTCShifter.address,
        ZECShifter: ZECShifter.address,
        zBTC: zBTC.address,
        zZEC: zZEC.address,
        ShifterRegistry: ShifterRegistry.address,
    });
}