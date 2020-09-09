/// <reference types="../types/truffle-contracts" />

const NULL = "0x0000000000000000000000000000000000000000";
const NULL1 = "0x0000000000000000000000000000000000000001";

const GatewayRegistry = artifacts.require("GatewayRegistry");

const RenERC20LogicV1 = artifacts.require("RenERC20LogicV1");

const GatewayLogicV1 = artifacts.require("GatewayLogicV1");

const BTCGateway = artifacts.require("BTCGateway");
const RenBTC = artifacts.require("RenBTC");

const ZECGateway = artifacts.require("ZECGateway");
const RenZEC = artifacts.require("RenZEC");

const BCHGateway = artifacts.require("BCHGateway");
const RenBCH = artifacts.require("RenBCH");

const DarknodePayment = artifacts.require("DarknodePayment");
const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const ProtocolLogicV1 = artifacts.require("ProtocolLogicV1");
const ProtocolProxy = artifacts.require("ProtocolProxy");
const BasicAdapter = artifacts.require("BasicAdapter");
const RenProxyAdmin = artifacts.require("RenProxyAdmin");

const networks = require("./networks.js");
const { encodeCallData } = require("./encode");

/**
 * @param {any} deployer
 * @param {string} network
 */
module.exports = async function (deployer, network) {

    const contractOwner = (await web3.eth.getAccounts())[0];

    const Ox = web3.utils.toChecksumAddress;

    deployer.logger.log(`Deploying to ${network} (${network.replace("-fork", "")})...`);

    network = network.replace("-fork", "");

    const addresses = networks[network] || {};
    const config = networks[network] ? networks[network].config : networks.config;
    const _mintAuthority = config.mintAuthority || contractOwner;

    // TODO: _feeRecipient should be the DarknodePayment contract
    const _feeRecipient = DarknodePaymentStore.address || addresses.DarknodePaymentStore || contractOwner;

    BTCGateway.address = addresses.BTCGateway || "";
    ZECGateway.address = addresses.ZECGateway || "";
    BCHGateway.address = addresses.BCHGateway || "";
    GatewayRegistry.address = addresses.GatewayRegistry || "";
    GatewayLogicV1.address = addresses.GatewayLogicV1 || "";
    RenZEC.address = addresses.renZEC || "";
    RenBCH.address = addresses.renBCH || "";
    RenBTC.address = addresses.renBTC || "";
    BasicAdapter.address = addresses.BasicAdapter || "";
    RenERC20LogicV1.address = addresses.RenERC20LogicV1 || "";

    const darknodePayment = await DarknodePayment.at(DarknodePayment.address);
    const protocol = await ProtocolLogicV1.at(ProtocolProxy.address);
    let renProxyAdmin = await RenProxyAdmin.at(RenProxyAdmin.address);

    let actionCount = 0;

    /** Registry **************************************************************/

    if (!GatewayRegistry.address) {
        deployer.logger.log(`Deploying Gateway contract`);
        await deployer.deploy(
            GatewayRegistry,
        );
        actionCount++;
    }
    const registry = await GatewayRegistry.at(GatewayRegistry.address);

    const protocolGatewayRegistry = await protocol.gatewayRegistry.call();
    if (Ox(protocolGatewayRegistry) !== Ox(registry.address)) {
        deployer.logger.log(`Updating GatewayRegistry in Protocol contract. Was ${protocolGatewayRegistry}, now is ${registry.address}`);
        await protocol._updateGatewayRegistry(registry.address);
        actionCount++;
    }

    if (!BasicAdapter.address) {
        deployer.logger.log(`Deploying BasicAdapter`);
        await deployer.deploy(
            BasicAdapter,
            registry.address,
        );
        actionCount++;
    }

    // try {
    //     deployer.logger.log("Attempting to change cycle");
    //     await darknodePayment.changeCycle();
    // } catch (error) {
    //     deployer.logger.log("Unable to call darknodePayment.changeCycle()");
    // }

    if (!RenERC20LogicV1.address) {
        deployer.logger.log(`Deploying RenERC20LogicV1 logic`);
        await deployer.deploy(RenERC20LogicV1);
        actionCount++;
    }
    const renERC20Logic = await RenERC20LogicV1.at(RenERC20LogicV1.address);

    // Initialize RenERC20Logic so others can't.
    if (Ox(await renERC20Logic.owner()) === Ox(NULL)) {
        deployer.logger.log("Ensuring RenERC20Logic is initialized");
        await renERC20Logic.initialize(0, contractOwner, "1000000000000000000", "1", "", "", 0);
        actionCount++;
    }

    if (!GatewayLogicV1.address) {
        deployer.logger.log(`Deploying GatewayLogicV1 logic`);
        await deployer.deploy(GatewayLogicV1);
        actionCount++;
    }
    const gatewayLogic = await GatewayLogicV1.at(GatewayLogicV1.address);

    // Initialize GatewayLogic so others can't.
    if (Ox(await gatewayLogic.owner()) === Ox(NULL)) {
        deployer.logger.log("Ensuring GatewayLogic is initialized");
        await gatewayLogic.initialize(
            NULL,
            NULL1,
            NULL1,
            10000,
            10000,
            0
        );
        actionCount++;
    }

    const chainID = await web3.eth.net.getId();

    for (const [Token, Gateway, name, decimals, minimumBurnAmount] of [
        [RenBTC, BTCGateway, "BTC", 8, config.renBTCMinimumBurnAmount],
        [RenZEC, ZECGateway, "ZEC", 8, config.renZECMinimumBurnAmount],
        [RenBCH, BCHGateway, "BCH", 8, config.renBCHMinimumBurnAmount],
    ]) {
        const symbol = `${config.tokenPrefix}${name}`;
        deployer.logger.log(`Handling ${symbol}`);

        if (!Token.address) {
            deployer.logger.log(`Deploying ${symbol} proxy`);
            await deployer.deploy(Token);
            const tokenProxy = await Token.at(Token.address);
            await tokenProxy.initialize(RenERC20LogicV1.address, renProxyAdmin.address, encodeCallData(
                web3,
                "initialize",
                ["uint256", "address", "uint256", "string", "string", "string", "uint8"],
                [chainID, contractOwner, "1000000000000000000", "1", symbol, symbol, decimals])
            );
            actionCount++;
        }
        const token = await RenERC20LogicV1.at(Token.address);

        const tokenProxyLogic = await renProxyAdmin.getProxyImplementation(Token.address);
        if (Ox(tokenProxyLogic) !== Ox(RenERC20LogicV1.address)) {
            deployer.logger.log(`${symbol} is pointing to out-dated RenERC20Logic.`);
            await renProxyAdmin.upgrade(Token.address, RenERC20LogicV1.address);
            actionCount++;
        }

        if (!Gateway.address) {
            deployer.logger.log(`Deploying ${symbol} Gateway proxy`);
            await deployer.deploy(Gateway);
            const tokenProxy = await Gateway.at(Gateway.address);
            await tokenProxy.initialize(GatewayLogicV1.address, renProxyAdmin.address, encodeCallData(
                web3,
                "initialize",
                ["address", "address", "address", "uint16", "uint16", "uint256"],
                [
                    Token.address,
                    _feeRecipient,
                    _mintAuthority,
                    config.mintFee,
                    config.burnFee,
                    minimumBurnAmount,
                ])
            );
            actionCount++;
        }
        const tokenGateway = await GatewayLogicV1.at(Gateway.address);

        const gatewayProxyLogic = await renProxyAdmin.getProxyImplementation(tokenGateway.address);
        if (Ox(gatewayProxyLogic) !== Ox(GatewayLogicV1.address)) {
            deployer.logger.log(`${symbol} gateway is pointing to out-dated GatewayLogic.`);
            await renProxyAdmin.upgrade.write(tokenGateway.address, GatewayLogicV1.address);
            actionCount++;
        }

        const gatewayMintAuthority = await tokenGateway.mintAuthority.call();
        if (Ox(gatewayMintAuthority) !== Ox(_mintAuthority)) {
            deployer.logger.log(`Updating mint authority in ${symbol} Gateway. Was ${gatewayMintAuthority}, now is ${_mintAuthority}`);
            await tokenGateway.updateMintAuthority(_mintAuthority);
            actionCount++;
        }

        const tokenOwner = await token.owner.call();
        if (Ox(tokenOwner) !== Ox(tokenGateway.address)) {
            deployer.logger.log(`Transferring ${symbol} ownership`);

            if (Ox(tokenOwner) === Ox(contractOwner)) {
                await token.transferOwnership(tokenGateway.address);

                // Update token's Gateway contract
                deployer.logger.log(`Claiming ${symbol} ownership in Gateway`);
                await tokenGateway.claimTokenOwnership();
            } else {
                deployer.logger.log(`Transferring token ownership from ${tokenOwner} to new ${symbol} Gateway`);
                const oldGateway = await Gateway.at(tokenOwner);
                await oldGateway.transferTokenOwnership(tokenGateway.address);
                // This will also call claim, but we try anyway because older
                // contracts didn't:
                try {
                    // Claim ownership
                    await tokenGateway.claimTokenOwnership();
                } catch (error) {
                    console.error(error);
                }
            }
            actionCount++;
        }

        let tokenRegistered = (await darknodePayment.registeredTokenIndex.call(Token.address)).toString() !== "0";
        const pendingRegistration = await darknodePayment.tokenPendingRegistration.call(Token.address);
        if (!tokenRegistered && !pendingRegistration) {
            deployer.logger.log(`Registering token ${symbol} in DarknodePayment`);
            await darknodePayment.registerToken(Token.address);
            actionCount++;
        }

        const registered = await registry.getGatewayByToken.call(Token.address);
        if (Ox(registered) === Ox(NULL) || Ox(registered) !== Ox(Gateway.address)) {
            const otherRegistration = (await registry.getGatewayBySymbol.call(name));
            if (Ox(otherRegistration) === Ox(NULL)) {
                deployer.logger.log(`Registering ${symbol} Gateway`);
                await registry.setGateway(name, Token.address, Gateway.address);
            } else {
                deployer.logger.log(`Updating registered ${symbol} Gateway (was ${otherRegistration})`);
                await registry.updateGateway(Token.address, Gateway.address);
            }
            actionCount++;
        }

        const feeRecipient = await tokenGateway.feeRecipient.call();
        if (Ox(feeRecipient) !== Ox(DarknodePaymentStore.address)) {
            deployer.logger.log(`Updating fee recipient for ${symbol} Gateway. Was ${Ox(feeRecipient)}, now is ${Ox(_feeRecipient)}`);
            await tokenGateway.updateFeeRecipient(_feeRecipient);
            actionCount++;
        }
    }

    deployer.logger.log(`Performed ${actionCount} updates.`);

    /** LOG *******************************************************************/

    deployer.logger.log(`
        /* 2_shifter.js */

        GatewayRegistry: "${GatewayRegistry.address}",
        BasicAdapter: "${BasicAdapter.address}",

        RenERC20LogicV1: "${RenERC20LogicV1.address}",
        GatewayLogicV1: "${GatewayLogicV1.address}",

        // BTC
        renBTC: "${RenBTC.address}",
        BTCGateway: "${BTCGateway.address}",

        // ZEC
        renZEC: "${RenZEC.address}",
        ZECGateway: "${ZECGateway.address}",

        // BCH
        renBCH: "${RenBCH.address}",
        BCHGateway: "${BCHGateway.address}",`
    );
}
