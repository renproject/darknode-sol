/// <reference types="../types/truffle-contracts" />

const NULL = "0x0000000000000000000000000000000000000000";

const GatewayRegistry = artifacts.require("GatewayRegistry");

const RenERC20LogicV1 = artifacts.require("RenERC20LogicV1");

const GatewayLogicV1 = artifacts.require("GatewayLogicV1");

const BTCGateway = artifacts.require("BTCGateway");
const renBTC = artifacts.require("renBTC");

const ZECGateway = artifacts.require("ZECGateway");
const renZEC = artifacts.require("renZEC");

const BCHGateway = artifacts.require("BCHGateway");
const renBCH = artifacts.require("renBCH");

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
 * @param {any[]} accounts
 */
module.exports = async function (deployer, network, [contractOwner]) {
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
    renZEC.address = addresses.renZEC || "";
    renBCH.address = addresses.renBCH || "";
    renBTC.address = addresses.renBTC || "";
    BasicAdapter.address = addresses.BasicAdapter || "";
    RenERC20LogicV1.address = addresses.RenERC20Logic || "";

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
    if (protocolGatewayRegistry.toLowerCase() !== registry.address.toLowerCase()) {
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

    if (!GatewayLogicV1.address) {
        deployer.logger.log(`Deploying GatewayLogicV1 logic`);
        await deployer.deploy(GatewayLogicV1);
        actionCount++;
    }

    const chainID = await web3.eth.net.getId();

    for (const [Token, Gateway, name, decimals, minimumBurnAmount] of [
        [renBTC, BTCGateway, "BTC", 8, config.renBTCMinimumBurnAmount],
        [renZEC, ZECGateway, "ZEC", 8, config.renZECMinimumBurnAmount],
        [renBCH, BCHGateway, "BCH", 8, config.renBCHMinimumBurnAmount],
    ]) {
        const symbol = `${config.tokenPrefix}${name}`;

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
        if (tokenProxyLogic.toLowerCase() !== RenERC20LogicV1.address.toLowerCase()) {
            throw new Error(`ERROR: ${name} token is pointing to out-dated ProtocolLogicV1.`);
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

        const gatewayProxyLogic = await renProxyAdmin.getProxyImplementation(Gateway.address);
        if (gatewayProxyLogic.toLowerCase() !== GatewayLogicV1.address.toLowerCase()) {
            throw new Error(`ERROR: ${name} gateway is pointing to out-dated ProtocolLogicV1.`);
        }

        const gatewayMintAuthority = await tokenGateway.mintAuthority.call();
        if (gatewayMintAuthority.toLowerCase() !== _mintAuthority.toLowerCase()) {
            deployer.logger.log(`Updating mint authority in ${symbol} Gateway. Was ${gatewayMintAuthority}, now is ${_mintAuthority}`);
            await tokenGateway.updateMintAuthority(_mintAuthority);
            actionCount++;
        }

        const tokenOwner = await token.owner.call();
        if (tokenOwner !== Gateway.address) {
            deployer.logger.log(`Transferring ${symbol} ownership`);

            if (tokenOwner === contractOwner) {
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
        if (registered === NULL || registered !== Gateway.address) {
            const otherRegistration = (await registry.getGatewayBySymbol.call(symbol));
            if (otherRegistration === NULL) {
                deployer.logger.log(`Registering ${symbol} Gateway`);
                await registry.setGateway(name, Token.address, Gateway.address);
            } else {
                deployer.logger.log(`Updating registered ${symbol} Gateway (was ${otherRegistration})`);
                await registry.updateGateway(Token.address, Gateway.address);
            }
            actionCount++;
        }

        const feeRecipient = await tokenGateway.feeRecipient.call();
        if (feeRecipient.toLowerCase() !== DarknodePaymentStore.address.toLowerCase()) {
            deployer.logger.log(`Updating fee recipient for ${symbol} Gateway. Was ${feeRecipient.toLowerCase()}, now is ${_feeRecipient.toLowerCase()}`);
            await tokenGateway.updateFeeRecipient(_feeRecipient);
            actionCount++;
        }
    }

    deployer.logger.log(`Performed ${actionCount} updates.`);

    /** LOG *******************************************************************/

    deployer.logger.log({
        BTCGateway: BTCGateway.address,
        ZECGateway: ZECGateway.address,
        BCHGateway: BCHGateway.address,
        renBTC: renBTC.address,
        renZEC: renZEC.address,
        renBCH: renBCH.address,
        GatewayRegistry: GatewayRegistry.address,
        BasicAdapter: BasicAdapter.address,
    });
}