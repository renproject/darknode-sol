import BigNumber from "bignumber.js";
import BN from "bn.js";
import seedrandom from "seedrandom";

import {
    ClaimlessRewardsInstance,
    DarknodePaymentInstance,
    DarknodePaymentStoreInstance,
    DarknodeRegistryLogicV1Instance,
    DarknodeSlasherInstance,
    ERC20Instance,
    RenTokenInstance
} from "../../types/truffle-contracts";
import {
    DAYS,
    ETHEREUM,
    getDecimals,
    HOURS,
    ID,
    increaseTime,
    MINIMUM_BOND,
    NULL,
    PUBK,
    range,
    toBN,
    waitForEpoch
} from "../helper/testUtils";
import { STEPS } from "./steps";

const RenToken = artifacts.require("RenToken");
const ERC20 = artifacts.require("PaymentToken");
const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const ClaimlessRewards = artifacts.require("ClaimlessRewards");
const DarknodePayment = artifacts.require("DarknodePayment");
const DarknodeRegistryProxy = artifacts.require("DarknodeRegistryProxy");
const DarknodeRegistryLogicV1 = artifacts.require("DarknodeRegistryLogicV1");
const SelfDestructingToken = artifacts.require("SelfDestructingToken");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");

contract("ClaimlessRewards", (accounts: string[]) => {
    let store: DarknodePaymentStoreInstance;
    let dai: ERC20Instance;
    let erc20Token: ERC20Instance;
    let dnr: DarknodeRegistryLogicV1Instance;
    let rewards: ClaimlessRewardsInstance;
    let ren: RenTokenInstance;
    let slasher: DarknodeSlasherInstance;
    let dnp: DarknodePaymentInstance;

    const owner = accounts[0];
    const operator1 = accounts[1];
    const operator2 = accounts[2];

    before(async () => {
        ren = await RenToken.deployed();
        dai = await ERC20.new("DAI");
        erc20Token = await ERC20.new("ERC20");
        const dnrProxy = await DarknodeRegistryProxy.deployed();
        dnr = await DarknodeRegistryLogicV1.at(dnrProxy.address);
        store = await DarknodePaymentStore.deployed();
        rewards = await ClaimlessRewards.deployed();
        dnp = await DarknodePayment.deployed();
        slasher = await DarknodeSlasher.deployed();
        await dnr.updateSlasher(slasher.address);

        await dnp.transferStoreOwnership(rewards.address);
        await dnr.updateDarknodePayment(rewards.address);
        await dnr.updateMinimumEpochInterval(60 * 60);
        await STEPS.waitForEpoch(rewards);

        new BN(await dnr.numDarknodes.call()).should.bignumber.equal(new BN(0));
    });

    after(async () => {
        await rewards.transferStoreOwnership(dnp.address);
        await dnr.updateDarknodePayment(dnp.address);
        await dnr.updateMinimumEpochInterval(30);
    });

    afterEach(async () => {
        // Deregister tokens.
        const tokens = await rewards.getRegisteredTokens.call();
        for (const token of tokens) {
            await rewards.deregisterToken(token);
        }

        await STEPS.waitForEpoch(rewards);

        // Deregister darknodes.
        const darknodes = await dnr.getDarknodes.call(NULL, 0);
        if (darknodes.length) {
            for (const darknode of darknodes) {
                await dnr.deregister(darknode, {
                    from: await dnr.getDarknodeOperator.call(darknode)
                });
            }

            await STEPS.waitForEpoch(rewards);

            await STEPS.waitForEpoch(rewards);

            for (const darknode of darknodes) {
                await dnr.refund(darknode, {
                    from: await dnr.getDarknodeOperator.call(darknode)
                });
            }
        }
    });

    describe("Token registration", async () => {
        it("cannot register token if not owner", async () => {
            await rewards
                .registerToken(dai.address, { from: accounts[1] })
                .should.be.rejectedWith(/Ownable: caller is not the owner/);
        });

        it("can register token", async () => {
            // No tokens should be registered.
            (await rewards.getRegisteredTokens.call()).length.should.equal(0);

            await STEPS.registerToken(rewards, dai.address);
            await STEPS.registerToken(rewards, erc20Token.address);
            await STEPS.registerToken(rewards, ETHEREUM);

            (await rewards.getRegisteredTokens.call()).length.should.equal(3);
        });

        it("cannot register already registered tokens", async () => {
            await STEPS.registerToken(rewards, dai.address);
            await rewards
                .registerToken(dai.address)
                .should.be.rejectedWith(
                    /ClaimlessRewards: token already registered/
                );
        });

        it("cannot deregister token if not owner", async () => {
            await STEPS.registerToken(rewards, ETHEREUM);
            await rewards
                .deregisterToken(ETHEREUM, { from: accounts[1] })
                .should.be.rejectedWith(/Ownable: caller is not the owner/);
        });

        it("can deregister tokens", async () => {
            await STEPS.registerToken(rewards, dai.address);
            await STEPS.registerToken(rewards, erc20Token.address);
            await STEPS.registerToken(rewards, ETHEREUM);

            await STEPS.deregisterToken(rewards, ETHEREUM);
            await rewards
                .deregisterToken(ETHEREUM)
                .should.be.rejectedWith(
                    /ClaimlessRewards: token not registered/
                );
            await STEPS.deregisterToken(rewards, erc20Token.address);
            await STEPS.deregisterToken(rewards, dai.address);

            await STEPS.registerToken(rewards, ETHEREUM);
            await STEPS.deregisterToken(rewards, ETHEREUM);
        });

        it("can deregister a destroyed token", async () => {
            await registerNode(6);
            await STEPS.waitForEpoch(rewards);
            await STEPS.waitForEpoch(rewards);

            // Register token.
            const sdt = await SelfDestructingToken.new();
            await STEPS.registerToken(rewards, sdt.address);
            await STEPS.waitForEpoch(rewards);

            // Self destruct token.
            await sdt.destruct();
            await STEPS.deregisterToken(rewards, sdt.address);

            await deregisterNode(6);
            await STEPS.waitForEpoch(rewards);
            await STEPS.waitForEpoch(rewards);
            await refundNode(6);
            await STEPS.waitForEpoch(rewards);
        });

        it("cannot deregister unregistered tokens", async () => {
            await rewards
                .deregisterToken(ETHEREUM)
                .should.be.rejectedWith(
                    /ClaimlessRewards: token not registered/
                );
        });
    });

    describe("Token deposits", async () => {
        it("can deposit ETH via direct payment to DarknodePaymentStore contract", async () => {
            // deposit using direct deposit to store
            const oldETHBalance = new BN(
                await store.totalBalance.call(ETHEREUM)
            );
            const oldFreeBalance = new BN(
                await store.availableBalance.call(ETHEREUM)
            );
            const amount = new BN(1).mul(new BN(10).pow(new BN(18)));
            await web3.eth.sendTransaction({
                to: store.address,
                from: owner,
                value: amount.toString()
            });
            // Total balance has increased.
            new BN(
                await store.totalBalance.call(ETHEREUM)
            ).should.bignumber.equal(oldETHBalance.add(amount));
            // Reward pool has increased.
            new BN(
                await store.availableBalance.call(ETHEREUM)
            ).should.bignumber.equal(oldFreeBalance.add(amount));
        });
    });

    describe("Claiming rewards", async () => {
        it("nodes can earn ETH", async () => {
            // register ETH token and two darknodes
            await registerNode([1, 2]);
            await STEPS.registerToken(rewards, ETHEREUM);
            await STEPS.waitForEpoch(rewards);

            // Add 1 ETH to rewards.
            await STEPS.addRewards(
                rewards,
                ETHEREUM,
                new BN(1).mul(new BN(10).pow(new BN(18)))
            );

            // We should have zero claimed balance before ticking
            (
                await rewards.darknodeBalances.call(ID(1), ETHEREUM)
            ).should.bignumber.equal(0);

            // Change cycle after 1 month.
            await STEPS.changeCycle(rewards, 28 * DAYS);

            const node1Amount1 = await STEPS.withdraw(
                rewards,
                ID(1),
                ETHEREUM,
                operator1
            );

            await STEPS.changeCycle(rewards, 28 * DAYS);

            const node1Amount2 = await STEPS.withdraw(
                rewards,
                ID(1),
                ETHEREUM,
                operator1
            );

            const node2Amount1 = await STEPS.withdraw(
                rewards,
                ID(2),
                ETHEREUM,
                operator2
            );

            node2Amount1.should.bignumber.equal(
                node1Amount1.plus(node1Amount2)
            );

            await STEPS.changeCycle(rewards, 1 * HOURS);

            await STEPS.deregisterToken(rewards, ETHEREUM);

            await STEPS.changeCycle(rewards, 1 * HOURS);

            // Can still withdraw owed ETH rewards after deregistration.
            (
                await STEPS.withdraw(rewards, ID(1), ETHEREUM, operator1)
            ).should.bignumber.greaterThan(0);
            await STEPS.withdraw(rewards, ID(2), ETHEREUM, operator2);

            await STEPS.changeCycle(rewards, 1 * HOURS);

            // No more ETH rewards to withdraw.
            (
                await STEPS.withdraw(rewards, ID(1), ETHEREUM, operator1)
            ).should.bignumber.equal(0);

            await deregisterNode([1, 2]);
            await STEPS.waitForEpoch(rewards);
            await STEPS.waitForEpoch(rewards);
            await refundNode([1, 2]);
            await STEPS.waitForEpoch(rewards);
        });

        it("nodes can earn DAI", async () => {
            // register ETH token and two nodes
            await registerNode([1, 2]);
            await STEPS.registerToken(rewards, [ETHEREUM, dai.address]);
            await STEPS.waitForEpoch(rewards);

            // Add 101.00...01 DAI to rewards.
            await STEPS.addRewards(
                rewards,
                dai.address,
                new BN(101).mul(new BN(10).pow(new BN(18))).add(new BN(1))
            );

            await STEPS.changeCycle(rewards, 1 * HOURS);

            await STEPS.withdraw(rewards, ID(1), dai.address, operator1);

            await STEPS.changeCycle(rewards, 28 * DAYS);

            await STEPS.withdraw(rewards, ID(1), dai.address, operator1);

            await STEPS.changeCycle(rewards, 28 * DAYS);

            await STEPS.withdraw(rewards, ID(1), dai.address, operator1);
            await STEPS.withdraw(rewards, ID(2), dai.address, operator2);

            await STEPS.deregisterToken(rewards, ETHEREUM);
            await STEPS.deregisterToken(rewards, dai.address);
            await deregisterNode([1, 2]);
            await STEPS.waitForEpoch(rewards);
            await STEPS.waitForEpoch(rewards);
            await refundNode([1, 2]);
            await STEPS.waitForEpoch(rewards);
        });

        it("nodes can earn ETH and DAI", async () => {
            // register ETH token and two darknodes
            await registerNode([1, 2]);
            await STEPS.registerToken(rewards, [ETHEREUM, dai.address]);
            await STEPS.waitForEpoch(rewards);

            // Add 101.00...01 DAI to rewards.
            await STEPS.addRewards(
                rewards,
                dai.address,
                new BN(101).mul(new BN(10).pow(new BN(18))).add(new BN(1))
            );

            // Add 1 ETH to rewards.
            await STEPS.addRewards(
                rewards,
                ETHEREUM,
                new BN(1).mul(new BN(10).pow(new BN(18)))
            );

            await STEPS.changeCycle(rewards, 28 * DAYS);

            await STEPS.withdraw(rewards, ID(1), dai.address, operator1);
            await STEPS.withdraw(rewards, ID(1), ETHEREUM, operator1);

            await STEPS.changeCycle(rewards, 28 * DAYS);

            await STEPS.withdraw(
                rewards,
                ID(1),
                [dai.address, ETHEREUM],
                operator1
            );

            await STEPS.deregisterToken(rewards, ETHEREUM);
            await STEPS.deregisterToken(rewards, dai.address);
            await deregisterNode([1, 2]);
            await STEPS.waitForEpoch(rewards);
            await STEPS.waitForEpoch(rewards);
            await refundNode([1, 2]);
            await STEPS.waitForEpoch(rewards);
        });

        it("node can withdraw after deregistering", async () => {
            // register ETH token and two darknodes
            await registerNode([1, 2]);
            await STEPS.registerToken(rewards, ETHEREUM);
            await STEPS.waitForEpoch(rewards);

            // Add 1 ETH to rewards.
            await STEPS.addRewards(
                rewards,
                ETHEREUM,
                new BN(1).mul(new BN(10).pow(new BN(18)))
            );

            // Change cycle after 1 month.
            await STEPS.changeCycle(rewards, 28 * DAYS);

            // Check that deregistering doesn't affect withdrawable balance.

            const node1BalanceBefore = await toBN(
                rewards.darknodeBalances.call(ID(1), ETHEREUM)
            );
            const node2BalanceBefore = await toBN(
                rewards.darknodeBalances.call(ID(2), ETHEREUM)
            );
            node1BalanceBefore.should.bignumber.equal(node2BalanceBefore);

            await deregisterNode(1);

            const node1BalanceAfter = await toBN(
                rewards.darknodeBalances.call(ID(1), ETHEREUM)
            );
            const node2BalanceAfter = await toBN(
                rewards.darknodeBalances.call(ID(2), ETHEREUM)
            );
            node1BalanceAfter.should.bignumber.equal(node2BalanceAfter);

            (
                await STEPS.withdraw(rewards, ID(1), ETHEREUM, operator1)
            ).should.bignumber.greaterThan(0);

            await STEPS.waitForEpoch(rewards);

            // The node can withdraw its rewards from it's last epoch.
            (
                await STEPS.withdraw(rewards, ID(1), ETHEREUM, operator1)
            ).should.bignumber.greaterThan(0);

            await STEPS.waitForEpoch(rewards);

            // The node should no longer be earning rewards.
            (
                await STEPS.withdraw(rewards, ID(1), ETHEREUM, operator1)
            ).should.bignumber.equal(0);
            await STEPS.waitForEpoch(rewards);

            await refundNode(1);

            await STEPS.withdraw(
                rewards,
                operator1,
                ETHEREUM
            ).should.be.rejectedWith(/ClaimlessRewards: not operator/);

            await STEPS.deregisterToken(rewards, ETHEREUM);
            await deregisterNode(2);
            await STEPS.waitForEpoch(rewards);
            await STEPS.waitForEpoch(rewards);
            await refundNode(2);
            await STEPS.waitForEpoch(rewards);
        });

        it("can withdraw after re-registering", async () => {
            // register ETH token and two darknodes
            await registerNode(1);
            await STEPS.registerToken(rewards, ETHEREUM);
            await STEPS.waitForEpoch(rewards);

            // Add 1 ETH to rewards.
            await STEPS.addRewards(
                rewards,
                ETHEREUM,
                new BN(1).mul(new BN(10).pow(new BN(18)))
            );

            await deregisterNode(1);
            await STEPS.waitForEpoch(rewards);
            await STEPS.waitForEpoch(rewards);

            // Ensure all rewards have been withdrawn.
            await STEPS.withdraw(rewards, ID(1), ETHEREUM, operator1);

            await refundNode(1);

            await STEPS.changeCycle(rewards, 28 * DAYS);

            await registerNode([1, 2]);

            await STEPS.waitForEpoch(rewards);

            const node1Amount = await STEPS.withdraw(
                rewards,
                ID(1),
                ETHEREUM,
                operator1
            );
            const node2Amount = await STEPS.withdraw(
                rewards,
                ID(2),
                ETHEREUM,
                operator2
            );

            // node1 should not be able to withdraw additional rewards,
            // since it re-registered at the same time as node2.
            node2Amount.should.bignumber.equal(node1Amount);

            await STEPS.deregisterToken(rewards, ETHEREUM);
            await deregisterNode([1, 2]);
            await STEPS.waitForEpoch(rewards);
            await STEPS.waitForEpoch(rewards);
            await refundNode([1, 2]);
            await STEPS.waitForEpoch(rewards);
        });

        it("calling cycle immediately will not add new timestamp", async () => {
            await STEPS.changeCycle(rewards, 1 * HOURS);
            await STEPS.changeCycle(rewards, 0 * HOURS).should.be.rejectedWith(
                /ClaimlessRewards: previous cycle too recent/
            );
        });

        it("epoch can progress even if cycle is too recent", async () => {
            const timeout = new BN(
                (await dnr.minimumEpochInterval.call()).toString()
            ).toNumber();

            await increaseTime(Math.max(timeout, 1 * HOURS));

            await STEPS.changeCycle(rewards, 0);
            await dnr.epoch();
        });

        it("can withdraw for multiple nodes", async () => {
            // register ETH token and two darknodes
            await registerNode([1, 2], operator1);
            await STEPS.registerToken(rewards, [ETHEREUM, dai.address]);
            await STEPS.waitForEpoch(rewards);

            // Add 101.00...01 DAI to rewards.
            await STEPS.addRewards(
                rewards,
                dai.address,
                new BN(101).mul(new BN(10).pow(new BN(18))).add(new BN(1))
            );

            // Add 1 ETH to rewards.
            await STEPS.addRewards(
                rewards,
                ETHEREUM,
                new BN(1).mul(new BN(10).pow(new BN(18)))
            );

            await STEPS.changeCycle(rewards, 28 * DAYS);

            // Withdraw DAI for second nodes.
            await STEPS.withdraw(rewards, [ID(2)], dai.address, operator1);

            await STEPS.changeCycle(rewards, 28 * DAYS);

            // Withdraw DAI and ETH for both nodes.
            await STEPS.withdraw(
                rewards,
                [ID(1), ID(2)],
                [dai.address, ETHEREUM],
                operator1
            );

            await STEPS.deregisterToken(rewards, ETHEREUM);
            await STEPS.deregisterToken(rewards, dai.address);
            await deregisterNode([1, 2], operator1);
            await STEPS.waitForEpoch(rewards);
            await STEPS.waitForEpoch(rewards);
            await refundNode([1, 2], operator1);
            await STEPS.waitForEpoch(rewards);
        });

        it("only operator can withdraw", async () => {
            // register ETH token and two darknodes
            await registerNode([1, 2]);
            await STEPS.registerToken(rewards, [ETHEREUM, dai.address]);
            await STEPS.waitForEpoch(rewards);

            // Add 101.00...01 DAI to rewards.
            await STEPS.addRewards(
                rewards,
                dai.address,
                new BN(101).mul(new BN(10).pow(new BN(18))).add(new BN(1))
            );

            await STEPS.changeCycle(rewards, 28 * DAYS);

            await STEPS.withdraw(
                rewards,
                ID(1),
                dai.address,
                operator2
            ).should.be.rejectedWith(/ClaimlessRewards: not operator/);

            await STEPS.withdraw(rewards, ID(1), dai.address, operator1);
            await STEPS.withdraw(rewards, ID(2), dai.address, operator2);

            await STEPS.deregisterToken(rewards, ETHEREUM);
            await STEPS.deregisterToken(rewards, dai.address);
            await deregisterNode([1, 2]);
            await STEPS.waitForEpoch(rewards);
            await STEPS.waitForEpoch(rewards);
            await refundNode([1, 2]);
            await STEPS.waitForEpoch(rewards);
        });

        it("nodes can withdraw after migrating from DarknodePayment contract", async function() {
            // Requires Darknode Registry implementation to be upgraded mid-test.

            this.timeout(100 * 300000);

            const seed = 0.4957910354433912; // 20
            // const seed = 0.12399667580170748; // 4
            // const seed = Math.random();
            console.log(`Starting test with seed ${seed}.`);
            const rng = seedrandom(seed.toString());

            await rewards.transferStoreOwnership(dnp.address);
            await dnr.updateDarknodePayment(dnp.address);

            const newToken = await ERC20.new("DAI2");
            await dnp.registerToken(newToken.address);

            (
                await store.darknodeBalances.call(NULL, newToken.address)
            ).should.bignumber.equal(0);

            const darknodeIndices = range(20);

            // Register 50 nodes before switching to ClaimlessRewards.
            let previousCanClaim = 0;
            for (const index of darknodeIndices.slice(
                0,
                Math.floor(darknodeIndices.length / 2)
            )) {
                await registerNode(index);

                if (rng() < 0.5) {
                    await waitForEpoch(dnr);

                    // Claim for any darknode that has been registered for two
                    // epochs.
                    for (const indexInner of darknodeIndices.slice(
                        0,
                        previousCanClaim
                    )) {
                        await dnp.claim(ID(indexInner));
                    }

                    previousCanClaim = index;

                    // Add random amount of DAI to rewards.
                    await STEPS.addRewards(
                        dnp,
                        newToken.address,
                        new BigNumber(rng())
                            .times(1000)
                            .times(
                                new BigNumber(10).exponentiatedBy(
                                    await getDecimals(newToken.address)
                                )
                            )
                    );
                }
            }

            await waitForEpoch(dnr);
            await waitForEpoch(dnr);
            for (const index of darknodeIndices.slice(
                0,
                Math.floor(darknodeIndices.length / 2)
            )) {
                await dnp.claim(ID(index));
            }

            // Withdraw legacy rewards for first 25 nodes.
            for (const index of darknodeIndices.slice(
                0,
                Math.floor(darknodeIndices.length / 2)
            )) {
                if (rng() < 0.5) {
                    await dnp.withdraw(ID(index), newToken.address);
                }
            }

            rewards = await ClaimlessRewards.new(
                dnr.address,
                store.address,
                owner,
                50000
            );
            await dnp.transferStoreOwnership(rewards.address);
            await dnr.updateDarknodePayment(rewards.address);
            await STEPS.registerToken(rewards, [ETHEREUM, newToken.address]);

            // Register 50 nodes after switching to ClaimlessRewards.
            for (const index of darknodeIndices.slice(
                Math.floor(darknodeIndices.length / 2)
            )) {
                await registerNode(index);

                if (rng() < 0.5) {
                    await STEPS.waitForEpoch(rewards);

                    await STEPS.changeCycle(rewards, 28 * DAYS);

                    // Add random amount of DAI to rewards.
                    await STEPS.addRewards(
                        rewards,
                        newToken.address,
                        new BigNumber(rng())
                            .times(1000)
                            .times(
                                new BigNumber(10).exponentiatedBy(
                                    await getDecimals(newToken.address)
                                )
                            )
                    );
                }
            }

            // await STEPS.waitForEpoch(rewards);

            // // Deregister random nodes.
            // for (const index of darknodeIndices.slice(
            //     0,
            //     darknodeIndices.length
            // )) {
            //     if (rng() < 0.2) {
            //         await deregisterNode(index);
            //     }

            //     if (rng() < 0.5) {
            //         await STEPS.waitForEpoch(rewards);

            //         // Add random amount of DAI to rewards.
            //         await STEPS.addRewards(
            //             dnp,
            //             newToken.address,
            //             new BigNumber(rng())
            //                 .times(1000)
            //                 .times(
            //                     new BigNumber(10).exponentiatedBy(
            //                         await getDecimals(newToken.address)
            //                     )
            //                 )
            //         );

            //         await STEPS.changeCycle(rewards, 1 * HOURS);
            //     }
            // }

            await STEPS.waitForEpoch(rewards);

            for (const index of darknodeIndices) {
                await STEPS.withdraw(
                    rewards,
                    ID(index),
                    newToken.address,
                    accounts[index % accounts.length]
                );
            }

            (
                await store.darknodeBalances.call(NULL, newToken.address)
            ).should.bignumber.equal(0);

            await STEPS.deregisterToken(rewards, ETHEREUM);
            await STEPS.deregisterToken(rewards, newToken.address);
            await deregisterNode(darknodeIndices);
            await STEPS.waitForEpoch(rewards);
            await STEPS.waitForEpoch(rewards);
            await refundNode(darknodeIndices);
            await STEPS.waitForEpoch(rewards);
        });

        it("balance if pending registration is 0", async () => {
            // register ETH token and two darknodes
            await registerNode(1);
            await STEPS.registerToken(rewards, ETHEREUM);

            await rewards.darknodeBalances
                .call(ID(1), ETHEREUM)
                .should.be.rejectedWith(
                    /ClaimlessRewards: registration pending/
                );
        });
    });

    describe("getNextEpochFromTimestamp", () => {
        it("should return the correct timestamp", async () => {
            const timestamps = await rewards.getEpochTimestamps.call();

            for (let i = 0; i < timestamps.length; i++) {
                const timestamp = new BigNumber(timestamps[i].toString());
                const nextTimestamp = timestamps[i + 1]
                    ? new BigNumber(timestamps[i + 1].toString())
                    : undefined;
                const previousTimestamp = timestamps[i - 1]
                    ? new BigNumber(timestamps[i - 1].toString())
                    : undefined;

                // Check that timestamps are ordered.
                if (nextTimestamp) {
                    nextTimestamp.should.be.bignumber.greaterThan(timestamp);
                }
                if (previousTimestamp) {
                    previousTimestamp.should.be.bignumber.lessThan(timestamp);
                }

                // Check that getNextEpochFromTimestamp(timestamp - 1) == timestamp
                (
                    await rewards.getNextEpochFromTimestamp.call(
                        timestamp.minus(1).toFixed()
                    )
                ).should.bignumber.equal(
                    previousTimestamp &&
                        timestamp.minus(1).isEqualTo(previousTimestamp)
                        ? previousTimestamp
                        : timestamp
                );

                // Check that getNextEpochFromTimestamp(timestamp) == timestamp
                (
                    await rewards.getNextEpochFromTimestamp.call(
                        timestamp.toFixed()
                    )
                ).should.bignumber.equal(timestamp);

                // Check that getNextEpochFromTimestamp(timestamp + 1) == next timestamp
                (
                    await rewards.getNextEpochFromTimestamp.call(
                        timestamp.plus(1).toFixed()
                    )
                ).should.bignumber.equal(nextTimestamp || new BigNumber(0));
            }

            if (timestamps.length) {
                (
                    await rewards.getNextEpochFromTimestamp.call(0)
                ).should.bignumber.equal(timestamps[0]);
            }
        });
    });

    describe("Transferring ownership", () => {
        it("should disallow unauthorized transferring of ownership", async () => {
            await rewards
                .transferStoreOwnership(accounts[1], { from: accounts[1] })
                .should.be.rejectedWith(/Ownable: caller is not the owner/);
            await rewards
                .claimStoreOwnership({ from: accounts[1] })
                .should.be.rejectedWith(
                    /Claimable: caller is not the pending owner/
                );
        });

        it("can transfer ownership of the darknode payment store", async () => {
            const newDarknodePayment = await ClaimlessRewards.new(
                dnr.address,
                store.address,
                owner,
                50000
            );

            // [ACTION] Initiate ownership transfer to wrong account
            await rewards.transferStoreOwnership(newDarknodePayment.address, {
                from: accounts[0]
            });

            // [CHECK] Owner should be the new rewards contract.
            (await store.owner.call()).should.equal(newDarknodePayment.address);

            // [RESET] Initiate ownership transfer back to rewards.
            await newDarknodePayment.transferStoreOwnership(rewards.address);

            // [CHECK] Owner should now be the rewards.
            (await store.owner.call()).should.equal(rewards.address);
        });
    });

    describe("when forwarding funds", async () => {
        it("can forward ETH", async () => {
            await rewards.forward(NULL);
        });

        it("can forward funds to the store", async () => {
            // rewards should have zero balance
            new BN(
                await dai.balanceOf.call(rewards.address)
            ).should.bignumber.equal(new BN(0));

            const storeDaiBalance = new BN(
                await store.availableBalance.call(dai.address)
            );
            const amount = new BN("1000000");
            new BN(await dai.balanceOf.call(owner)).gte(amount).should.be.true;
            await dai.transfer(rewards.address, amount);

            (
                await store.availableBalance.call(dai.address)
            ).should.bignumber.equal(storeDaiBalance);
            // rewards should have some balance
            new BN(
                await dai.balanceOf.call(rewards.address)
            ).should.bignumber.equal(amount);

            // Forward the funds on
            await rewards.forward(dai.address);
            new BN(
                await dai.balanceOf.call(rewards.address)
            ).should.bignumber.equal(new BN(0));
            (
                await store.availableBalance.call(dai.address)
            ).should.bignumber.equal(storeDaiBalance.add(amount));
        });
    });

    describe("when changing payout proportion", async () => {
        it("cannot change payout proportion to an invalid percent", async () => {
            const denominator = await toBN(
                rewards.HOURLY_PAYOUT_WITHHELD_DENOMINATOR.call()
            );
            await rewards
                .updateHourlyPayoutWithheld(denominator.plus(1).toFixed())
                .should.be.rejectedWith(/ClaimlessRewards: invalid numerator/);
        });

        it("can change payout proportion", async () => {
            // register ETH token and two darknodes
            await registerNode([1, 2]);
            await STEPS.registerToken(rewards, [ETHEREUM, dai.address]);
            await STEPS.waitForEpoch(rewards);

            // Ensure there are no fees from other tests.
            await STEPS.withdraw(rewards, ID(1), dai.address, operator1);

            // Add 101.00...01 DAI to rewards.
            await STEPS.addRewards(
                rewards,
                dai.address,
                new BN(101).mul(new BN(10).pow(new BN(18)))
            );

            const oldNumerator = await toBN(
                rewards.hourlyPayoutWithheldNumerator.call()
            );
            const denominator = await toBN(
                rewards.HOURLY_PAYOUT_WITHHELD_DENOMINATOR.call()
            );
            await rewards.updateHourlyPayoutWithheld(denominator.toFixed());

            await STEPS.changeCycle(rewards, 28 * DAYS);

            (
                await STEPS.withdraw(rewards, ID(1), dai.address, operator1)
            ).should.bignumber.equal(0);

            await rewards.updateHourlyPayoutWithheld(0);

            await STEPS.changeCycle(rewards, 28 * DAYS);

            // No rewards should have been withheld, except rounded amounts too
            // small to be distributed to all darknodes.
            const numberOfDarknodes = await toBN(dnr.numDarknodes.call());
            (
                await store.availableBalance.call(dai.address)
            ).should.bignumber.lessThan(numberOfDarknodes);

            await STEPS.withdraw(rewards, ID(1), dai.address, operator1);

            await rewards.updateHourlyPayoutWithheld(oldNumerator.toFixed());

            await STEPS.deregisterToken(rewards, ETHEREUM);
            await STEPS.deregisterToken(rewards, dai.address);
            await deregisterNode([1, 2]);
            await STEPS.waitForEpoch(rewards);
            await STEPS.waitForEpoch(rewards);
            await refundNode([1, 2]);
            await STEPS.waitForEpoch(rewards);
        });
    });

    describe("admin methods", async () => {
        it("only admin can update payout proportions", async () => {
            await rewards
                .updateHourlyPayoutWithheld(new BN(10), { from: accounts[2] })
                .should.be.rejectedWith(/Ownable: caller is not the owner./);
        });

        describe("DarknodeRegistry", () => {
            it("only admin can update darknode registry", async () => {
                await rewards
                    .updateDarknodeRegistry(accounts[2], { from: accounts[2] })
                    .should.be.rejectedWith(
                        /Ownable: caller is not the owner./
                    );
            });

            it("can update DarknodeRegistry", async () => {
                const darknodeRegistry = await rewards.darknodeRegistry.call();
                await rewards
                    .updateDarknodeRegistry(NULL)
                    .should.be.rejectedWith(
                        /ClaimlessRewards: invalid Darknode Registry address/
                    );

                await rewards.updateDarknodeRegistry(accounts[0]);
                await rewards.updateDarknodeRegistry(darknodeRegistry);
            });
        });

        describe("community fund", () => {
            it("only admin can update community fund", async () => {
                await rewards
                    .updateCommunityFund(accounts[2], { from: accounts[2] })
                    .should.be.rejectedWith(
                        /Ownable: caller is not the owner./
                    );
            });

            it("only admin can update community fund percent", async () => {
                await rewards
                    .updateCommunityFundNumerator(0, { from: accounts[2] })
                    .should.be.rejectedWith(
                        /Ownable: caller is not the owner./
                    );
            });

            it("can withdraw community fund rewards", async () => {
                // register ETH token and two darknodes
                await registerNode([1, 2]);
                await STEPS.registerToken(rewards, [ETHEREUM, dai.address]);
                await STEPS.waitForEpoch(rewards);

                // Add 101.00...01 DAI to rewards.
                await STEPS.addRewards(
                    rewards,
                    dai.address,
                    new BN(101).mul(new BN(10).pow(new BN(18))).add(new BN(1))
                );

                // Add 1 ETH to rewards.
                await STEPS.addRewards(
                    rewards,
                    ETHEREUM,
                    new BN(1).mul(new BN(10).pow(new BN(18)))
                );

                await STEPS.changeCycle(rewards, 28 * DAYS);

                (
                    await STEPS.withdrawToCommunityFund(rewards, [
                        ETHEREUM,
                        dai.address
                    ])
                ).should.bignumber.greaterThan(0);

                // Second time - empty values.
                (
                    await STEPS.withdrawToCommunityFund(rewards, [
                        ETHEREUM,
                        dai.address
                    ])
                ).should.bignumber.equal(0);

                await STEPS.deregisterToken(rewards, ETHEREUM);
                await STEPS.deregisterToken(rewards, dai.address);
                await deregisterNode([1, 2]);
                await STEPS.waitForEpoch(rewards);
                await STEPS.waitForEpoch(rewards);
                await refundNode([1, 2]);
                await STEPS.waitForEpoch(rewards);
            });

            it("can update community fund", async () => {
                const communityFund = await rewards.communityFund.call();
                await rewards.updateCommunityFund(accounts[0]);
                await rewards.updateCommunityFund(communityFund);
            });

            it("cannot change community fund percent to an invalid percent", async () => {
                const denominator = await toBN(
                    rewards.HOURLY_PAYOUT_WITHHELD_DENOMINATOR.call()
                );
                await rewards
                    .updateCommunityFundNumerator(denominator.plus(1).toFixed())
                    .should.be.rejectedWith(
                        /ClaimlessRewards: invalid numerator/
                    );
            });

            it("can update community fund percent", async () => {
                // register ETH token and two darknodes
                await registerNode([1, 2]);
                await STEPS.registerToken(rewards, [ETHEREUM, dai.address]);
                await STEPS.waitForEpoch(rewards);

                // Ensure there are no community funds from previous tests.
                (
                    await STEPS.withdrawToCommunityFund(rewards, [
                        ETHEREUM,
                        dai.address
                    ])
                ).should.bignumber.greaterThan(0);

                // Add 101.00...01 DAI to rewards.
                await STEPS.addRewards(
                    rewards,
                    dai.address,
                    new BN(101).mul(new BN(10).pow(new BN(18))).add(new BN(1))
                );

                // Add 1 ETH to rewards.
                await STEPS.addRewards(
                    rewards,
                    ETHEREUM,
                    new BN(1).mul(new BN(10).pow(new BN(18)))
                );

                // Update community fund numerator to 0.
                const oldCommunityFundPercent = await toBN(
                    rewards.communityFundNumerator.call()
                );
                await rewards.updateCommunityFundNumerator(0);

                await STEPS.changeCycle(rewards, 28 * DAYS);

                (
                    await STEPS.withdrawToCommunityFund(rewards, [
                        ETHEREUM,
                        dai.address
                    ])
                ).should.bignumber.equal(0);

                // Second time - empty values.
                (
                    await STEPS.withdrawToCommunityFund(rewards, [
                        ETHEREUM,
                        dai.address
                    ])
                ).should.bignumber.equal(0);

                await STEPS.deregisterToken(rewards, ETHEREUM);
                await STEPS.deregisterToken(rewards, dai.address);
                await deregisterNode([1, 2]);
                await STEPS.waitForEpoch(rewards);
                await STEPS.waitForEpoch(rewards);
                await refundNode([1, 2]);
                await STEPS.waitForEpoch(rewards);

                // Revert community fund numerator change.
                await rewards.updateCommunityFundNumerator(
                    oldCommunityFundPercent.toFixed()
                );
            });

            it("can't set community fund to 0x0 or registered darknode", async () => {
                await rewards
                    .updateCommunityFund(NULL)
                    .should.be.rejectedWith(
                        /ClaimlessRewards: invalid community fund address/
                    );

                await registerNode(1);
                await rewards
                    .updateCommunityFund(ID(1))
                    .should.be.rejectedWith(
                        /ClaimlessRewards: community fund must not be a registered darknode/
                    );
            });

            it("malicious operator can't withdraw community fund", async () => {
                const communityFund = await rewards.communityFund.call();
                const malicious = accounts[4];
                await ren.transfer(malicious, MINIMUM_BOND);
                await ren.approve(dnr.address, MINIMUM_BOND, {
                    from: malicious
                });
                // Register the darknodes under the account address
                await dnr.register(communityFund, PUBK(-1), {
                    from: malicious
                });
                await STEPS.waitForEpoch(rewards);

                // Add 101.00...01 DAI to rewards.
                await STEPS.addRewards(
                    rewards,
                    dai.address,
                    new BN(101).mul(new BN(10).pow(new BN(18)))
                );
                await STEPS.changeCycle(rewards, 1 * HOURS);

                await STEPS.withdraw(
                    rewards,
                    communityFund,
                    dai.address
                ).should.be.rejectedWith(/ClaimlessRewards: invalid node ID/);
            });
        });
    });

    const registerNode = async (array: number | number[], from?: string) => {
        array = Array.isArray(array) ? array : [array];
        for (const i of array) {
            await ren.transfer(
                from || accounts[i % accounts.length],
                MINIMUM_BOND
            );
            await ren.approve(dnr.address, MINIMUM_BOND, {
                from: from || accounts[i % accounts.length]
            });
            // Register the darknodes under the account address
            await dnr.register(ID(i), PUBK(i), {
                from: from || accounts[i % accounts.length]
            });
        }
    };

    const deregisterNode = async (array: number | number[], from?: string) => {
        array = Array.isArray(array) ? array : [array];
        for (const i of array) {
            await dnr.deregister(ID(i), {
                from: from || accounts[i % accounts.length]
            });
        }
    };

    const refundNode = async (array: number | number[], from?: string) => {
        array = Array.isArray(array) ? array : [array];
        for (const i of array) {
            await dnr.refund(ID(i), {
                from: from || accounts[i % accounts.length]
            });
        }
    };
});
