import BN from "bn.js";

import {
    DarknodeRegistryLogicV1Instance,
    DarknodeRegistryLogicV2Instance,
    DarknodeRegistryStoreInstance,
    DarknodeRegistryV1ToV2UpgraderInstance,
    RenProxyAdminInstance,
    RenTokenInstance,
} from "../types/truffle-contracts";
import {
    encodeCallData,
    ID,
    MINIMUM_BOND,
    PUBK,
    signRecoverMessage,
    waitForEpoch,
} from "./helper/testUtils";

const RenToken = artifacts.require("RenToken");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const DarknodeRegistryProxy = artifacts.require("DarknodeRegistryProxy");
const DarknodeRegistryLogicV2 = artifacts.require("DarknodeRegistryLogicV2");
const DarknodeRegistryLogicV1 = artifacts.require("DarknodeRegistryLogicV1");
const RenProxyAdmin = artifacts.require("RenProxyAdmin");
const DarknodeRegistryV1ToV2Upgrader = artifacts.require(
    "DarknodeRegistryV1ToV2Upgrader"
);

const { config } = require("../migrations/networks");

const numAccounts = 10;

contract("DarknodeRegistryV1ToV2Upgrader", (accounts: string[]) => {
    let ren: RenTokenInstance;
    let dnrV1: DarknodeRegistryLogicV1Instance;
    let dnrV2: DarknodeRegistryLogicV2Instance;
    let darknodeRegistryLogicV1: DarknodeRegistryLogicV1Instance;
    let darknodeRegistryLogicV2: DarknodeRegistryLogicV2Instance;
    let renProxyAdmin: RenProxyAdminInstance;
    let upgrader: DarknodeRegistryV1ToV2UpgraderInstance;

    before(async () => {
        ren = await RenToken.deployed();
        renProxyAdmin = await RenProxyAdmin.deployed();

        const dnrs = await DarknodeRegistryStore.new("1", RenToken.address);

        darknodeRegistryLogicV1 = await DarknodeRegistryLogicV1.new();
        darknodeRegistryLogicV2 = await DarknodeRegistryLogicV2.new();
        const darknodeRegistryParameters = {
            types: [
                "string",
                "address",
                "address",
                "uint256",
                "uint256",
                "uint256",
                "uint256",
            ],
            values: [
                "1",
                RenToken.address,
                dnrs.address,
                config.MINIMUM_BOND.toString(),
                config.MINIMUM_POD_SIZE,
                config.MINIMUM_EPOCH_INTERVAL_SECONDS,
                0,
            ],
        };

        const darknodeRegistryProxy = await DarknodeRegistryProxy.new();
        await darknodeRegistryProxy.methods[
            "initialize(address,address,bytes)"
        ](
            darknodeRegistryLogicV1.address,
            renProxyAdmin.address,
            encodeCallData(
                web3,
                "initialize",
                darknodeRegistryParameters.types,
                darknodeRegistryParameters.values
            )
        );
        dnrV1 = await DarknodeRegistryLogicV1.at(darknodeRegistryProxy.address);
        dnrV2 = await DarknodeRegistryLogicV2.at(darknodeRegistryProxy.address);

        await dnrs.transferOwnership(dnrV1.address);
        await dnrV1.claimStoreOwnership();

        await waitForEpoch(dnrV1);
        await waitForEpoch(dnrV1);

        for (let i = 1; i < numAccounts; i++) {
            await ren.transfer(accounts[i], MINIMUM_BOND);
        }

        // Transfer accounts[numAccounts - 1] an additional MINIMUM_BOND so it can
        // register, deregister, and refund multiple darknodes
        await ren.transfer(accounts[numAccounts - 1], MINIMUM_BOND);

        upgrader = await DarknodeRegistryV1ToV2Upgrader.new(
            renProxyAdmin.address,
            darknodeRegistryProxy.address,
            darknodeRegistryLogicV2.address,
            { from: accounts[0] }
        );
    });

    it("can register, deregister and refund Darknodes", async function () {
        this.timeout(1000 * 1000);
        // [ACTION] Register
        for (let i = 0; i < numAccounts; i++) {
            await ren.approve(dnrV1.address, MINIMUM_BOND, {
                from: accounts[i],
            });
            await dnrV1.register(ID(i), PUBK(i), { from: accounts[i] });
        }

        const nodeCount = 10;
        await ren.transfer(accounts[2], MINIMUM_BOND.mul(new BN(nodeCount)));
        await ren.approve(dnrV1.address, MINIMUM_BOND.mul(new BN(nodeCount)), {
            from: accounts[2],
        });

        for (let i = numAccounts; i < numAccounts + nodeCount; i++) {
            await dnrV1.register(ID(i), PUBK(i), { from: accounts[2] });
        }

        // Wait for epoch
        await waitForEpoch(dnrV1);

        // [ACTION] Deregister
        for (let i = 0; i < numAccounts; i++) {
            await dnrV1.deregister(ID(i), { from: accounts[i] });
        }

        for (let i = numAccounts; i < numAccounts + nodeCount; i++) {
            await dnrV1.deregister(ID(i), { from: accounts[2] });
        }

        // Wait for two epochs
        await waitForEpoch(dnrV1);
        await waitForEpoch(dnrV1);

        // [ACTION] Refund
        for (let i = 0; i < numAccounts; i++) {
            await dnrV1.refund(ID(i), { from: accounts[i] });
        }

        for (let i = numAccounts; i < numAccounts + nodeCount; i++) {
            await dnrV1.refund(ID(i), { from: accounts[2] });
        }

        await ren.transfer(accounts[0], MINIMUM_BOND.mul(new BN(nodeCount)), {
            from: accounts[2],
        });
    });

    // it("can upgrade", async function () {
    //     /** **** UPGRADE **** */
    //     await dnrV1.transferOwnership(upgrader.address, { from: accounts[0] });
    //     await renProxyAdmin.transferOwnership(upgrader.address, {
    //         from: accounts[0],
    //     });

    //     await upgrader.upgrade({ from: accounts[0] });

    //     await upgrader.returnDNR();
    //     await upgrader.returnProxyAdmin();
    //     /** **** **** */
    // });

    // it("should be able to recover a darknode's bond", async function () {
    //     this.timeout(1000 * 1000);

    //     // [ACTION] Register
    //     for (let i = 0; i < numAccounts; i++) {
    //         await ren.approve(dnrV2.address, MINIMUM_BOND, {
    //             from: accounts[i],
    //         });
    //         await dnrV2.register(ID(i), PUBK(i), { from: accounts[i] });
    //     }

    //     const nodeCount = 10;
    //     await ren.transfer(accounts[2], MINIMUM_BOND.mul(new BN(nodeCount)));
    //     await ren.approve(dnrV2.address, MINIMUM_BOND.mul(new BN(nodeCount)), {
    //         from: accounts[2],
    //     });

    //     for (let i = numAccounts; i < numAccounts + nodeCount; i++) {
    //         await dnrV2.register(ID(i), PUBK(i), { from: accounts[2] });
    //     }

    //     // Wait for epoch
    //     await waitForEpoch(dnrV2);

    //     (
    //         await dnrV2.getOperatorDarknodes(accounts[2])
    //     ).length.should.bignumber.equal(nodeCount + 1); // +1 from the first loop

    //     const recovered: number[] = [];

    //     // [ACTION] Deregister
    //     for (let i = 0; i < numAccounts; i++) {
    //         await dnrV2.deregister(ID(i), { from: accounts[i] });
    //     }

    //     for (let i = numAccounts; i < numAccounts + nodeCount; i++) {
    //         if (recovered.indexOf(i) >= 0) {
    //             continue;
    //         }
    //         await dnrV2.deregister(ID(i), { from: accounts[2] });
    //     }

    //     // Wait for two epochs
    //     await waitForEpoch(dnrV2);

    //     // Recover
    //     const darknodeOperator = accounts[2];
    //     const recipient = accounts[3];
    //     const recipientBalanceBefore = await ren.balanceOf(recipient);
    //     const darknodeToRefund = numAccounts;
    //     const signature = await signRecoverMessage(
    //         darknodeOperator,
    //         recipient,
    //         ID(darknodeToRefund)
    //     );
    //     await dnrV2.recover(ID(darknodeToRefund), recipient, signature, {
    //         from: accounts[0],
    //     });
    //     recovered.push(darknodeToRefund);

    //     const recipientBalanceAfter = await ren.balanceOf(recipient);
    //     recipientBalanceAfter
    //         .sub(recipientBalanceBefore)
    //         .should.bignumber.equal(await dnrV2.minimumBond());
    //     await ren.transfer(darknodeOperator, await dnrV2.minimumBond(), {
    //         from: recipient,
    //     });
    //     (
    //         await dnrV2.getOperatorDarknodes(accounts[2])
    //     ).length.should.bignumber.equal(nodeCount);

    //     await waitForEpoch(dnrV2);

    //     // Recover
    //     const signatureThree = await signRecoverMessage(
    //         darknodeOperator,
    //         recipient,
    //         ID(darknodeToRefund + 1)
    //     );
    //     await dnrV2.recover(
    //         ID(darknodeToRefund + 1),
    //         recipient,
    //         signatureThree,
    //         {
    //             from: accounts[0],
    //         }
    //     );
    //     recovered.push(darknodeToRefund + 1);

    //     // [ACTION] Refund
    //     for (let i = 0; i < numAccounts; i++) {
    //         await dnrV2.refund(ID(i), { from: accounts[i] });
    //     }

    //     for (let i = numAccounts; i < numAccounts + nodeCount; i++) {
    //         if (recovered.indexOf(i) >= 0) {
    //             continue;
    //         }
    //         await dnrV2.refund(ID(i), { from: accounts[2] });
    //     }

    //     await ren.transfer(accounts[0], MINIMUM_BOND.mul(new BN(nodeCount)), {
    //         from: accounts[2],
    //     });
    // });

    it("can upgrade", async function () {
        this.timeout(1000 * 1000);

        // [ACTION] Register
        for (let i = 0; i < numAccounts; i++) {
            await ren.approve(dnrV1.address, MINIMUM_BOND, {
                from: accounts[i],
            });
            await dnrV1.register(ID(i), PUBK(i), { from: accounts[i] });
        }

        const nodeCount = 10;
        await ren.transfer(accounts[2], MINIMUM_BOND.mul(new BN(nodeCount)));
        await ren.approve(dnrV1.address, MINIMUM_BOND.mul(new BN(nodeCount)), {
            from: accounts[2],
        });

        for (let i = numAccounts; i < numAccounts + nodeCount; i++) {
            await dnrV1.register(ID(i), PUBK(i), { from: accounts[2] });
        }

        // Wait for epoch
        await waitForEpoch(dnrV1);

        const recovered: number[] = [];

        // [ACTION] Deregister
        for (let i = 0; i < numAccounts; i++) {
            await dnrV1.deregister(ID(i), { from: accounts[i] });
        }

        for (let i = numAccounts; i < numAccounts + nodeCount; i++) {
            if (recovered.indexOf(i) >= 0) {
                continue;
            }
            await dnrV1.deregister(ID(i), { from: accounts[2] });
        }

        // Wait for two epochs
        await waitForEpoch(dnrV1);

        /** **** UPGRADE **** */
        await dnrV1.transferOwnership(upgrader.address, { from: accounts[0] });
        await renProxyAdmin.transferOwnership(upgrader.address, {
            from: accounts[0],
        });

        await upgrader.upgrade({ from: accounts[0] });

        await upgrader.returnDNR();
        await upgrader.returnProxyAdmin();
        /** **** **** */

        // Recover
        const darknodeOperator = accounts[2];
        const recipient = accounts[3];
        const recipientBalanceBefore = await ren.balanceOf(recipient);
        const darknodeToRefund = numAccounts;
        const signature = await signRecoverMessage(
            darknodeOperator,
            recipient,
            ID(darknodeToRefund)
        );
        await dnrV2.recover(ID(darknodeToRefund), recipient, signature, {
            from: accounts[0],
        });
        recovered.push(darknodeToRefund);

        const recipientBalanceAfter = await ren.balanceOf(recipient);
        recipientBalanceAfter
            .sub(recipientBalanceBefore)
            .should.bignumber.equal(await dnrV2.minimumBond());
        await ren.transfer(darknodeOperator, await dnrV2.minimumBond(), {
            from: recipient,
        });

        await waitForEpoch(dnrV2);

        // Recover
        const signatureThree = await signRecoverMessage(
            darknodeOperator,
            recipient,
            ID(darknodeToRefund + 1)
        );
        await dnrV2.recover(
            ID(darknodeToRefund + 1),
            recipient,
            signatureThree,
            {
                from: accounts[0],
            }
        );
        recovered.push(darknodeToRefund + 1);

        // [ACTION] Refund
        for (let i = 0; i < numAccounts; i++) {
            await dnrV2.refund(ID(i), { from: accounts[i] });
        }

        for (let i = numAccounts; i < numAccounts + nodeCount; i++) {
            if (recovered.indexOf(i) >= 0) {
                continue;
            }
            await dnrV2.refund(ID(i), { from: accounts[2] });
        }

        await ren.transfer(accounts[0], MINIMUM_BOND.mul(new BN(nodeCount)), {
            from: accounts[2],
        });
    });

    // it("can register, deregister and refund Darknodes", async function () {
    //     this.timeout(1000 * 1000);
    //     // [ACTION] Register
    //     for (let i = 0; i < numAccounts; i++) {
    //         await ren.approve(dnrV2.address, MINIMUM_BOND, {
    //             from: accounts[i],
    //         });
    //         await dnrV2.register(ID(i), PUBK(i), { from: accounts[i] });
    //     }

    //     const nodeCount = 10;
    //     await ren.transfer(accounts[2], MINIMUM_BOND.mul(new BN(nodeCount)));
    //     await ren.approve(dnrV2.address, MINIMUM_BOND.mul(new BN(nodeCount)), {
    //         from: accounts[2],
    //     });

    //     for (let i = numAccounts; i < numAccounts + nodeCount; i++) {
    //         await dnrV2.register(ID(i), PUBK(i), { from: accounts[2] });
    //     }

    //     // Wait for epoch
    //     await waitForEpoch(dnrV2);

    //     (
    //         await dnrV2.getOperatorDarknodes(accounts[2])
    //     ).length.should.bignumber.equal(nodeCount + 1); // +1 from the first loop

    //     // [ACTION] Deregister
    //     for (let i = 0; i < numAccounts; i++) {
    //         await dnrV2.deregister(ID(i), { from: accounts[i] });
    //     }

    //     for (let i = numAccounts; i < numAccounts + nodeCount; i++) {
    //         await dnrV2.deregister(ID(i), { from: accounts[2] });
    //     }

    //     // Wait for two epochs
    //     await waitForEpoch(dnrV2);
    //     await waitForEpoch(dnrV2);

    //     // [ACTION] Refund
    //     for (let i = 0; i < numAccounts; i++) {
    //         await dnrV2.refund(ID(i), { from: accounts[i] });
    //     }

    //     for (let i = numAccounts; i < numAccounts + nodeCount; i++) {
    //         await dnrV2.refund(ID(i), { from: accounts[2] });
    //     }

    //     await ren.transfer(accounts[0], MINIMUM_BOND.mul(new BN(nodeCount)), {
    //         from: accounts[2],
    //     });
    // });
});
