/// <reference types="../test-ts/typings/truffle" />

const BN = require("bn.js");

const RenToken = artifacts.require("RenToken");
const DarknodePayment = artifacts.require("DarknodePayment");
const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");

const config = require("./config.js");

module.exports = async function (deployer, network, accounts) {

    const VERSION_STRING = `${network}-${config.VERSION}`;

    let tokens = new Map();

    if (network.match("kovan")) {
        RenToken.address = "0x2cd647668494c1b15743ab283a0f980d90a87394";
        DarknodeSlasher.address = "0x0000000000000000000000000000000000000000";
        DarknodeRegistry.address = "0x1C6309618338D0EDf9a7Ea8eA18E060fD323020D";
        DarknodeRegistryStore.address = "0x88e4477e4fdd677aee2dc9376471d45c198669fa";
        DarknodePayment.address = "0x05c2F7a859A957BF23438DEBC7C5D4fAC8583995";
        DarknodePaymentStore.address = "0xA9411C3AD1fBE168fd119A3B32fB481a0b9877A9";
        tokens = new Map()
            .set("DAI", "0xc4375b7de8af5a38a93548eb8453a498222c4ff2")
            .set("ETH", "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE")
            .set("zBTC", "0x2a8368d2a983a0aeae8da0ebc5b7c03a0ea66b37")
            .set("zZEC", "0xd67256552f93b39ac30083b4b679718a061feae6");
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
    let registerTokens = true;
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
        registerTokens = true;
    }

    if (registerTokens) {
        const darknodePayment = await DarknodePayment.at(DarknodePayment.address);
        for (const [tokenName, tokenAddress] of tokens) {
            process.stdout.write(`\rRegistering tokens in DarknodePayment: ${tokenName}\t\t`);
            await darknodePayment.registerToken(tokenAddress);
        }
        process.stdout.write("\rRegistering tokens in DarknodePayment\t\t\n");
    }

    const darknodePayment = await DarknodePayment.at(DarknodePayment.address);

    const darknodePaymentStore = await DarknodePaymentStore.at(DarknodePaymentStore.address);
    const currentOwner = await darknodePaymentStore.owner();
    if (currentOwner !== DarknodePayment.address) {
        deployer.logger.log("Linking DarknodePaymentStore and DarknodePayment")
        // Initiate ownership transfer of DarknodePaymentStore

        if (accounts.indexOf(currentOwner) >= 0) {
            await darknodePaymentStore.transferOwnership(DarknodePayment.address, {
                from: currentOwner
            });
        } else {
            const oldDarknodePayment = await DarknodePayment.at(currentOwner);
            await oldDarknodePayment.transferStoreOwnership(DarknodePayment.address);
        }

        // Update DarknodePaymentStore address
        await darknodePayment.claimStoreOwnership();
    }

    if (new BN(await darknodePayment.cycleDuration()).toNumber() !== config.DARKNODE_PAYMENT_CYCLE_DURATION_SECS) {
        deployer.logger.log(`Updating cycle duration to ${config.DARKNODE_PAYMENT_CYCLE_DURATION_SECS}`);
        await darknodePayment.updateCycleDuration(config.DARKNODE_PAYMENT_CYCLE_DURATION_SECS);
    }

    if (changeCycle) {
        try {
            deployer.logger.log("Calling darknodePayment.changeCycle()");
            await darknodePayment.changeCycle();
        } catch (error) {
            console.error("Unable to call darknodePayment.changeCycle()");
        }
    }
}