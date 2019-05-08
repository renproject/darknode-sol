/// <reference types="../test-ts/typings/truffle" />

const BN = require("bn.js");

const RenToken = artifacts.require("RenToken");
const DarknodePayment = artifacts.require("DarknodePayment");
const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");

const config = require("./config.js");

module.exports = async function (deployer, network) {
    deployer.logger.log(`Deploying to ${network}...`);

    const VERSION_STRING = `${network}-${config.VERSION}`;

    let tokens = new Map();

    if (network.match("kovan")) {
        RenToken.address = "0x2cd647668494c1b15743ab283a0f980d90a87394";
        DarknodeSlasher.address = "0x0000000000000000000000000000000000000000";
        DarknodeRegistry.address = "0x1C6309618338D0EDf9a7Ea8eA18E060fD323020D";
        DarknodeRegistryStore.address = "0x88e4477e4fdd677aee2dc9376471d45c198669fa";
        DarknodePaymentStore.address = "0x731Ea4Ba77fF184d89dBeB160A0078274Acbe9D2";
        DarknodePayment.address = "0x5a7802E66b067cB1770ee5b1165AA201690A8B6a";
        tokens = new Map()
            .set("DAI", "0xc4375b7de8af5a38a93548eb8453a498222c4ff2")
            .set("ETH", "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE")
        // .set("zBTC", "0x2a8368d2a983a0aeae8da0ebc5b7c03a0ea66b37")
        // .set("zZEC", "0xd67256552f93b39ac30083b4b679718a061feae6");
        ;
    } else if (network.match("mainnet")) {
        RenToken.address = "0x408e41876cCCDC0F92210600ef50372656052a38";
        DarknodeSlasher.address = "0x0000000000000000000000000000000000000000";
        DarknodeRegistry.address = "0x34bd421C7948Bc16f826Fd99f9B785929b121633";
        DarknodeRegistryStore.address = "0x06df0657ba5e8f5339e742212669f6e7ee3c5057";
        DarknodePaymentStore.address = "";
        DarknodePayment.address = "";
        tokens = new Map()
            .set("DAI", "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359")
            .set("ETH", "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");
    } else {
        RenToken.address = "";
        DarknodeSlasher.address = "";
        DarknodeRegistry.address = "";
        DarknodeRegistryStore.address = "";
        DarknodePayment.address = "";
        DarknodePaymentStore.address = "";
    }

    if (!RenToken.address) {
        deployer.logger.log("Deploying RenToken");
        await deployer.deploy(RenToken);
    }

    /** DARKNODE REGISTRY *****************************************************/
    if (!DarknodeRegistry.address) {
        deployer.logger.log("Deploying DarknodeRegistryStore");
        await deployer.deploy(
            DarknodeRegistryStore,
            VERSION_STRING,
            RenToken.address,
        );
    }

    if (!DarknodeRegistry.address) {
        deployer.logger.log("Deploying DarknodeRegistry");
        await deployer.deploy(
            DarknodeRegistry,
            VERSION_STRING,
            RenToken.address,
            DarknodeRegistryStore.address,
            config.MINIMUM_BOND,
            config.MINIMUM_POD_SIZE,
            config.MINIMUM_EPOCH_INTERVAL
        );
    }

    const darknodeRegistryStore = await DarknodeRegistryStore.at(DarknodeRegistryStore.address);
    if ((await darknodeRegistryStore.owner()) !== DarknodeRegistry.address) {
        deployer.logger.log("Linking DarknodeRegistryStore and DarknodeRegistry")
        // Initiate ownership transfer of DNR store 
        await darknodeRegistryStore.transferOwnership(DarknodeRegistry.address);

        // Claim ownership
        const darknodeRegistry = await DarknodeRegistry.at(DarknodeRegistry.address);
        await darknodeRegistry.claimStoreOwnership();
    }

    /** SLASHER **************************************************************/
    if (!DarknodeSlasher.address) {
        deployer.logger.log("Deploying DarknodeSlasher");
        await deployer.deploy(
            DarknodeSlasher,
            DarknodeRegistry.address,
        );
    }

    const darknodeRegistry = await DarknodeRegistry.at(DarknodeRegistry.address);
    if ((await darknodeRegistry.slasher()) != DarknodeSlasher.address) {
        deployer.logger.log("Linking DarknodeSlasher and DarknodeRegistry")
        // Update slasher address
        await darknodeRegistry.updateSlasher(DarknodeSlasher.address);
    }

    /** DARKNODE PAYMENT ******************************************************/
    if (!DarknodePaymentStore.address) {
        deployer.logger.log("Deploying DarknodePaymentStore");
        await deployer.deploy(
            DarknodePaymentStore,
            VERSION_STRING,
        );
    }

    let changeCycle = false;
    if (!DarknodePayment.address) {
        // Deploy Darknode Payment
        deployer.logger.log("Deploying DarknodePayment");
        await deployer.deploy(
            DarknodePayment,
            VERSION_STRING,
            DarknodeRegistry.address,
            DarknodePaymentStore.address,
            0, // Cycle Duration (updated below, after a cycle has been called)
        );
        changeCycle = true;
    }

    const darknodePayment = await DarknodePayment.at(DarknodePayment.address);
    for (const [tokenName, tokenAddress] of tokens) {
        const registered = await darknodePayment.registeredTokenIndex(tokenAddress);
        if (registered.toString() === "0") {
            deployer.logger.log(`Registering token ${tokenName} in DarknodePayment`);
            await darknodePayment.registerToken(tokenAddress);
        }
    }

    const darknodePaymentStore = await DarknodePaymentStore.at(DarknodePaymentStore.address);
    const currentOwner = await darknodePaymentStore.owner();
    if (currentOwner !== DarknodePayment.address) {
        deployer.logger.log("Linking DarknodePaymentStore and DarknodePayment")
        // Initiate ownership transfer of DarknodePaymentStore

        try {
            await darknodePaymentStore.transferOwnership(DarknodePayment.address, {
                from: currentOwner
            });
        } catch (error) {
            const oldDarknodePayment = await DarknodePayment.at(currentOwner);
            await oldDarknodePayment.transferStoreOwnership(DarknodePayment.address);
        }

        // Update DarknodePaymentStore address
        await darknodePayment.claimStoreOwnership();
    }

    if (new BN(await darknodePayment.cycleDuration()).toNumber() !== config.DARKNODE_PAYMENT_CYCLE_DURATION_SECONDS) {
        deployer.logger.log(`Updating cycle duration to ${config.DARKNODE_PAYMENT_CYCLE_DURATION_SECONDS}`);
        await darknodePayment.updateCycleDuration(config.DARKNODE_PAYMENT_CYCLE_DURATION_SECONDS);
    }

    if (changeCycle) {
        try {
            deployer.logger.log("Updating cycle length");
            await darknodePayment.changeCycle();
        } catch (error) {
            console.error("Unable to call darknodePayment.changeCycle()");
        }
    }
}