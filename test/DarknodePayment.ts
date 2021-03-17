import BN from "bn.js";

import {
    DarknodePaymentInstance,
    DarknodePaymentStoreInstance,
    DarknodeRegistryLogicV1Instance,
    DarknodeSlasherInstance,
    ERC20Instance,
    RenTokenInstance
} from "../types/truffle-contracts";
import {
    ETHEREUM,
    MINIMUM_BOND,
    NULL,
    PUBK,
    waitForEpoch
} from "./helper/testUtils";

const Claimer = artifacts.require("Claimer");
const RenToken = artifacts.require("RenToken");
const ERC20 = artifacts.require("PaymentToken");
const DarknodePaymentStore = artifacts.require("DarknodePaymentStore");
const DarknodePayment = artifacts.require("DarknodePayment");
const DarknodeRegistryProxy = artifacts.require("DarknodeRegistryProxy");
const DarknodeRegistryLogicV1 = artifacts.require("DarknodeRegistryLogicV1");
const SelfDestructingToken = artifacts.require("SelfDestructingToken");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");

const { config } = require("../migrations/networks");

contract("DarknodePayment", (accounts: string[]) => {
    let store: DarknodePaymentStoreInstance;
    let dai: ERC20Instance;
    let erc20Token: ERC20Instance;
    let dnr: DarknodeRegistryLogicV1Instance;
    let dnp: DarknodePaymentInstance;
    let ren: RenTokenInstance;
    let slasher: DarknodeSlasherInstance;

    const owner = accounts[0];
    const darknode1 = accounts[1];
    const darknode2 = accounts[2];
    const darknode3 = accounts[3];
    const darknode6 = accounts[6];

    before(async () => {
        ren = await RenToken.deployed();
        dai = await ERC20.new("DAI");
        erc20Token = await ERC20.new("ERC20");
        const dnrProxy = await DarknodeRegistryProxy.deployed();
        dnr = await DarknodeRegistryLogicV1.at(dnrProxy.address);
        store = await DarknodePaymentStore.deployed();
        dnp = await DarknodePayment.deployed();
        slasher = await DarknodeSlasher.deployed();
        await dnr.updateSlasher(slasher.address);

        await waitForEpoch(dnr);

        new BN(await dnr.numDarknodes.call()).should.bignumber.equal(new BN(0));
    });

    afterEach(async () => {
        await waitForEpoch(dnr);
    });

    describe("Token registration", async () => {
        const tokenCount = async () => {
            let i = 0;
            while (true) {
                try {
                    await dnp.registeredTokens.call(i);
                    i++;
                } catch (error) {
                    break;
                }
            }
            return i;
        };

        const printTokens = async () => {
            console.info(`Registered tokens: [`);
            let i = 0;
            while (true) {
                try {
                    const token = await dnp.registeredTokens.call(i);
                    console.info(
                        `    ${token}, (${await dnp.registeredTokenIndex.call(
                            token
                        )})`
                    );
                    i++;
                } catch (error) {
                    break;
                }
            }
            console.info(`]`);
        };

        const checkTokenIndexes = async () => {
            let i = 0;
            while (true) {
                try {
                    const token = await dnp.registeredTokens.call(i);
                    (
                        await dnp.registeredTokenIndex.call(token)
                    ).should.bignumber.equal(i + 1);
                    i++;
                } catch (error) {
                    if (error.toString().match("invalid opcode")) {
                        break;
                    }
                    await printTokens();
                    throw error;
                }
            }
        };

        it("cannot register token if not owner", async () => {
            await dnp
                .registerToken(dai.address, { from: accounts[1] })
                .should.be.rejectedWith(/Ownable: caller is not the owner/);
        });

        it("can register tokens", async () => {
            const lengthBefore = await tokenCount();

            (await dnp.tokenPendingRegistration.call(dai.address)).should.equal(
                false
            );
            (
                await dnp.tokenPendingRegistration.call(erc20Token.address)
            ).should.equal(false);

            await dnp.registerToken(dai.address);
            (await dnp.tokenPendingRegistration.call(dai.address)).should.equal(
                true
            );
            await dnp
                .registerToken(dai.address)
                .should.be.rejectedWith(
                    /DarknodePayment: token already pending registration/
                );
            await dnp.registerToken(erc20Token.address);
            (
                await dnp.tokenPendingRegistration.call(erc20Token.address)
            ).should.equal(true);
            // complete token registration
            await waitForEpoch(dnr);
            (await dnp.registeredTokens.call(lengthBefore)).should.equal(
                dai.address
            );
            (
                await dnp.registeredTokenIndex.call(dai.address)
            ).should.bignumber.equal(new BN(lengthBefore + 1));
            (await dnp.tokenPendingRegistration.call(dai.address)).should.equal(
                false
            );
            (
                await dnp.tokenPendingRegistration.call(erc20Token.address)
            ).should.equal(false);

            await dnp.registerToken(ETHEREUM);
            // complete token registration
            await waitForEpoch(dnr);
            (await dnp.registeredTokens.call(lengthBefore + 2)).should.equal(
                ETHEREUM
            );
            (
                await dnp.registeredTokenIndex.call(ETHEREUM)
            ).should.bignumber.equal(lengthBefore + 3);
            await checkTokenIndexes();

            (await dnp.tokenPendingRegistration.call(dai.address)).should.equal(
                false
            );
            (
                await dnp.tokenPendingRegistration.call(erc20Token.address)
            ).should.equal(false);
        });

        it("can deregister a destroyed token", async () => {
            await registerDarknode(6);
            await waitForEpoch(dnr);
            await waitForEpoch(dnr);
            // Claim so that the darknode share count isn't 0.
            await dnp.claim(darknode6);
            const sdt = await SelfDestructingToken.new();
            await dnp.registerToken(sdt.address);
            await waitForEpoch(dnr);
            await sdt.destruct();
            await dnp.deregisterToken(sdt.address);
            await waitForEpoch(dnr);
            await slasher.blacklist(darknode6);
        });

        it("cannot register already registered tokens", async () => {
            await dnp
                .registerToken(dai.address)
                .should.be.rejectedWith(
                    /DarknodePayment: token already registered/
                );
        });

        it("cannot deregister token if not owner", async () => {
            await dnp
                .deregisterToken(ETHEREUM, { from: accounts[1] })
                .should.be.rejectedWith(/Ownable: caller is not the owner/);
        });

        it("can deregister tokens", async () => {
            await dnp.deregisterToken(ETHEREUM);
            await dnp
                .deregisterToken(ETHEREUM)
                .should.be.rejectedWith(
                    /DarknodePayment: token not registered/
                );
            await dnp.deregisterToken(erc20Token.address);
            // check token deregistration
            (
                await dnp.registeredTokenIndex.call(ETHEREUM)
            ).should.bignumber.equal(0);
            (
                await dnp.registeredTokenIndex.call(erc20Token.address)
            ).should.bignumber.equal(0);
            await checkTokenIndexes();
        });

        it("cannot deregister unregistered tokens", async () => {
            await dnp
                .deregisterToken(ETHEREUM)
                .should.be.rejectedWith(
                    /DarknodePayment: token not registered/
                );
        });

        it("properly sets index", async () => {
            const token1 = await ERC20.new();
            const token2 = await ERC20.new();
            const token3 = await ERC20.new();
            const one = token1.address;
            const two = token2.address;
            const three = token3.address;

            await checkTokenIndexes();
            await dnp.registerToken(one);
            await dnp.registerToken(two);
            await dnp.registerToken(three);
            await waitForEpoch(dnr);
            await checkTokenIndexes();

            // const expected = await dnp.registeredTokenIndex.call(one);
            await dnp.deregisterToken(one);
            await waitForEpoch(dnr);
            await checkTokenIndexes();
            // (await dnp.registeredTokenIndex.call(two)).should.bignumber.equal(expected);
            await dnp.deregisterToken(two);
            await dnp.deregisterToken(three);
            await checkTokenIndexes();
            await waitForEpoch(dnr);
            await checkTokenIndexes();
        });
    });

    describe("Token deposits", async () => {
        it("can deposit ETH using deposit()", async () => {
            // deposit using deposit() function
            const previousReward = new BN(
                await dnp.currentCycleRewardPool.call(ETHEREUM)
            );
            const oldETHBalance = new BN(
                await store.totalBalance.call(ETHEREUM)
            );
            const amount = new BN("1000000000");
            // make sure we have enough balance
            const ownerBalance = new BN(await web3.eth.getBalance(owner));
            ownerBalance.gte(amount).should.be.true;
            await dnp.deposit(amount, ETHEREUM, {
                value: amount.toString(),
                from: accounts[0]
            });
            new BN(
                await store.totalBalance.call(ETHEREUM)
            ).should.bignumber.equal(oldETHBalance.add(amount));
            // We should have increased the reward pool
            new BN(
                await dnp.currentCycleRewardPool.call(ETHEREUM)
            ).should.bignumber.equal(
                await asRewardPoolBalance(previousReward.add(amount))
            );
        });

        it("can deposit ETH via direct payment to DarknodePayment contract", async () => {
            // deposit using direct deposit to dnp
            const oldETHBalance = new BN(
                await store.totalBalance.call(ETHEREUM)
            );
            const amount = new BN("1000000000");
            // make sure we have enough balance
            const ownerBalance = new BN(await web3.eth.getBalance(owner));
            ownerBalance.gte(amount).should.be.true;
            await web3.eth.sendTransaction({
                to: dnp.address,
                from: owner,
                value: amount.toString()
            });
            new BN(
                await store.totalBalance.call(ETHEREUM)
            ).should.bignumber.equal(oldETHBalance.add(amount));
            // We should have increased the reward pool
            new BN(
                await dnp.currentCycleRewardPool.call(ETHEREUM)
            ).should.bignumber.equal(
                await asRewardPoolBalance(oldETHBalance.add(amount))
            );
        });

        it("can deposit ETH via direct payment to DarknodePaymentStore contract", async () => {
            // deposit using direct deposit to store
            const oldETHBalance = new BN(
                await store.totalBalance.call(ETHEREUM)
            );
            const amount = new BN("1000000000");
            await web3.eth.sendTransaction({
                to: store.address,
                from: owner,
                value: amount.toString()
            });
            new BN(
                await store.totalBalance.call(ETHEREUM)
            ).should.bignumber.equal(oldETHBalance.add(amount));
            // We should have increased the reward pool
            new BN(
                await dnp.currentCycleRewardPool.call(ETHEREUM)
            ).should.bignumber.equal(
                await asRewardPoolBalance(oldETHBalance.add(amount))
            );
        });

        it("cannot deposit ERC20 with ETH attached", async () => {
            const amount = new BN("100000000000000000");
            await dnp
                .deposit(amount, dai.address, { value: "1", from: accounts[0] })
                .should.be.rejectedWith(
                    /DarknodePayment: unexpected ether transfer/
                );
        });

        it("cannot deposit ERC20 that has not been registered", async () => {
            const before = new BN(await dai.balanceOf.call(accounts[0]));

            // Deregister dai and try to deposit
            await dnp.deregisterToken(dai.address);
            await waitForEpoch(dnr);

            // Approve and deposit
            await dai.approve(dnp.address, before);
            await dnp
                .deposit(before, dai.address, { from: accounts[0] })
                .should.be.rejectedWith(
                    /DarknodePayment: token not registered/
                );

            // RESET: Register dai back
            await dnp.registerToken(dai.address);
            await waitForEpoch(dnr);
        });
    });

    describe("Claiming rewards", async () => {
        it("cannot tick if not registered", async () => {
            await dnp
                .claim(accounts[0])
                .should.be.rejectedWith(
                    /DarknodePayment: darknode is not registered/
                );
        });

        it("cannot withdraw if there is no balance", async () => {
            await registerDarknode(1);
            await waitForEpoch(dnr);
            await waitForEpoch(dnr);

            const balanceBefore = await dai.balanceOf.call(owner);
            await dnp.withdraw(darknode1, dai.address);
            const balanceAfter = await dai.balanceOf.call(owner);
            balanceAfter.should.be.bignumber.equal(balanceBefore);
        });

        it("can be paid DAI from a payee", async () => {
            // darknode1 is whitelisted and can participate in rewards
            const previousBalance = new BN(
                await store.totalBalance.call(dai.address)
            );
            previousBalance.should.bignumber.equal(new BN(0));
            // sanity check that the reward pool is also zero
            (await fetchRewardPool(dai.address)).should.bignumber.equal(
                new BN(0)
            );

            // amount we're going to top up
            const amount = new BN("100000000000000000");
            await depositDai(amount);
            // We should have increased the reward pool
            const newRewardPool = await fetchRewardPool(dai.address);
            newRewardPool.should.bignumber.equal(
                await asRewardPoolBalance(amount)
            );

            // We should have zero claimed balance before ticking
            new BN(
                await dnp.darknodeBalances.call(darknode1, dai.address)
            ).should.bignumber.equal(new BN(0));

            // We don't need to claim since we weren't allocated rewards last cycle
            // But claim shouldn't revert
            await dnp.claim(darknode1);
            await waitForEpoch(dnr);

            const lastCycleRewards = await asRewardPoolBalance(amount);
            // We should be the only one who participated last cycle
            new BN(
                await dnr.numDarknodesPreviousEpoch.call()
            ).should.bignumber.equal(1);
            // We should be allocated all the rewards
            new BN(
                await dnp.unclaimedRewards.call(dai.address)
            ).should.bignumber.equal(lastCycleRewards);
            new BN(
                await dnp.previousCycleRewardShare.call(dai.address)
            ).should.bignumber.equal(lastCycleRewards);

            // Claim the rewards for last cycle
            await dnp.claim(darknode1);
            await waitForEpoch(dnr);

            const pool = await fetchRewardPool(dai.address);
            const entireDAIPool = new BN(
                await dnp.unclaimedRewards.call(dai.address)
            );
            entireDAIPool.should.bignumber.equal(
                await asRewardPoolBalance(lastCycleRewards)
            );
            pool.should.bignumber.equal(
                await asRewardPoolBalance(entireDAIPool)
            );
            const darknode1Balance = new BN(
                await dnp.darknodeBalances.call(darknode1, dai.address)
            );
            darknode1Balance.should.bignumber.equal(lastCycleRewards);

            // store.darknodeBalances should return the same as dnp.darknodeBalances
            (
                await store.darknodeBalances.call(darknode1, dai.address)
            ).should.bignumber.equal(darknode1Balance);
        });

        it("can be paid ETH from a payee", async () => {
            // register ETH
            await dnp.registerToken(ETHEREUM);
            await waitForEpoch(dnr);
            // ETH is now a registered token, claiming should now allocate balances

            const oldETHBalance = new BN(
                await store.totalBalance.call(ETHEREUM)
            );
            const amount = new BN("1000000000");
            await dnp
                .deposit(amount, ETHEREUM)
                .should.be.rejectedWith(
                    /DarknodePayment: mismatched deposit value/
                );
            await dnp.deposit(amount, ETHEREUM, {
                value: amount.toString(),
                from: accounts[0]
            });
            new BN(
                await store.totalBalance.call(ETHEREUM)
            ).should.bignumber.equal(oldETHBalance.add(amount));
            // We should have increased the reward pool
            const newReward = new BN(
                await dnp.currentCycleRewardPool.call(ETHEREUM)
            );
            newReward.should.bignumber.equal(
                await asRewardPoolBalance(oldETHBalance.add(amount))
            );

            // We should have zero claimed balance before ticking
            new BN(
                await dnp.darknodeBalances.call(darknode1, ETHEREUM)
            ).should.bignumber.equal(new BN(0));

            // We don't need to claim since we weren't allocated rewards last cycle
            // But claim shouldn't revert
            await dnp.claim(darknode1);
            await waitForEpoch(dnr);

            // We should be the only one who participated last cycle
            new BN(
                await dnr.numDarknodesPreviousEpoch.call()
            ).should.bignumber.equal(1);
            // We should be allocated all the rewards
            new BN(
                await dnp.unclaimedRewards.call(ETHEREUM)
            ).should.bignumber.equal(newReward);
            const rewardShare = new BN(
                await dnp.previousCycleRewardShare.call(ETHEREUM)
            );
            rewardShare.should.bignumber.equal(newReward);
            const lastCycleReward = new BN(
                await dnp.currentCycleRewardPool.call(ETHEREUM)
            );

            // Claim the rewards for last cycle
            await dnp.claim(darknode1);
            await waitForEpoch(dnr);
            const newPool = await asRewardPoolBalance(lastCycleReward);
            // There should be nothing left in the reward pool
            new BN(
                await dnp.currentCycleRewardPool.call(ETHEREUM)
            ).should.bignumber.equal(newPool);
            const earnedRewards = new BN(
                await dnp.darknodeBalances.call(darknode1, ETHEREUM)
            );
            earnedRewards.should.bignumber.equal(rewardShare);

            const oldBalance = new BN(await web3.eth.getBalance(darknode1));
            await dnp.withdraw(darknode1, ETHEREUM);

            // Our balances should have increased
            const newBalance = new BN(await web3.eth.getBalance(darknode1));
            newBalance.should.bignumber.equal(oldBalance.add(earnedRewards));

            // We should have nothing left to withdraw
            const postWithdrawRewards = new BN(
                await dnp.darknodeBalances.call(darknode1, ETHEREUM)
            );
            postWithdrawRewards.should.bignumber.equal(new BN(0));

            // Deregister ETH
            await dnp.deregisterToken(ETHEREUM);
            await waitForEpoch(dnr);
            (
                await dnp.registeredTokenIndex.call(ETHEREUM)
            ).should.bignumber.equal(0);
        });

        it("can pay out DAI when darknodes withdraw", async () => {
            const darknode1Balance = new BN(
                await dnp.darknodeBalances.call(darknode1, dai.address)
            );
            darknode1Balance.gt(new BN(0)).should.be.true;
            await withdraw(darknode1);
        });

        it("cannot call tick twice in the same cycle", async () => {
            await dnp.claim(darknode1);
            await dnp
                .claim(darknode1)
                .should.be.rejectedWith(
                    /DarknodePayment: reward already claimed/
                );
        });

        it("can tick again after a cycle has passed", async () => {
            await dnp.claim(darknode1);
            await waitForEpoch(dnr);
            await dnp.claim(darknode1);
        });

        it("should evenly split reward pool between ticked darknodes", async () => {
            const numDarknodes = 3;
            // Start from number 2 to avoid previous balances
            const startDarknode = 2;

            // We should only have one darknode
            new BN(
                await dnr.numDarknodesPreviousEpoch.call()
            ).should.bignumber.equal(1);
            // Register the darknodes
            for (let i = startDarknode; i < startDarknode + numDarknodes; i++) {
                await registerDarknode(i);
            }
            await waitForEpoch(dnr);
            // We should still only have one darknode
            new BN(
                await dnr.numDarknodesPreviousEpoch.call()
            ).should.bignumber.equal(1);

            // The darknodes should have zero balance
            for (let i = startDarknode; i < startDarknode + numDarknodes; i++) {
                const bal = new BN(
                    await dnp.darknodeBalances.call(accounts[i], dai.address)
                );
                bal.should.bignumber.equal(new BN(0));
                // since darknode has not been around for a full epoch
                await tick(accounts[i]).should.be.rejectedWith(
                    /DarknodePayment: cannot claim for this epoch/
                );
            }

            const rewards = new BN("300000000000000000");
            await depositDai(rewards);

            const rewardPool = await asRewardPoolBalance(
                await store.availableBalance.call(dai.address)
            );

            await waitForEpoch(dnr);

            const newRegisteredDarknodes = new BN(
                await dnr.numDarknodesPreviousEpoch.call()
            );
            // We should finally have increased the number of darknodes
            newRegisteredDarknodes.should.bignumber.equal(1 + numDarknodes);
            const expectedShare = rewardPool.div(newRegisteredDarknodes);

            await multiTick(startDarknode, numDarknodes);
            for (let i = startDarknode; i < startDarknode + numDarknodes; i++) {
                const darknodeBalance = await dnp.darknodeBalances.call(
                    accounts[i],
                    dai.address
                );
                darknodeBalance.should.bignumber.equal(expectedShare);
            }

            // Withdraw for each darknode
            await multiWithdraw(startDarknode, numDarknodes);

            // claim rewards for darknode1
            await tick(darknode1);
        });

        it("can call withdrawMultiple", async () => {
            // Deposit DAI and ETH
            const rewards = new BN("300000000000000000");
            await depositDai(rewards);
            await dnp.registerToken(ETHEREUM);
            await dnp.deposit(rewards, ETHEREUM, {
                value: rewards.toString(),
                from: accounts[0]
            });

            // Participate in rewards
            await tick(darknode1);
            // Change the epoch
            await waitForEpoch(dnr);

            // Claim rewards for past epoch
            await tick(darknode1);

            await waitForEpoch(dnr);

            // Claim rewards for past epoch
            await tick(darknode1);

            // Withdraw for each darknode
            await dnp.withdrawMultiple([darknode1], [dai.address, ETHEREUM]);
        });

        it("cannot withdraw if a darknode owner is invalid", async () => {
            await dnp
                .withdraw(NULL, dai.address)
                .should.be.rejectedWith(/invalid darknode owner/);
            // accounts[0] is not a registered darknode
            await dnp
                .withdraw(accounts[0], dai.address)
                .should.be.rejectedWith(/invalid darknode owner/);
        });

        it("cannot withdraw more than once in a cycle", async () => {
            const numDarknodes = 4;
            new BN(
                await dnr.numDarknodesPreviousEpoch.call()
            ).should.bignumber.equal(numDarknodes);

            const rewards = new BN("300000000000000000");
            await depositDai(rewards);
            await multiTick(1, numDarknodes);
            // Change the epoch
            await waitForEpoch(dnr);

            // Claim rewards for past cycle
            await multiTick(1, numDarknodes);

            // First withdraw should pass
            const balanceBefore = await dai.balanceOf.call(accounts[1]);
            await withdraw(darknode1);
            const balanceAfter = await dai.balanceOf.call(accounts[1]);
            balanceAfter.should.be.bignumber.greaterThan(balanceBefore);

            // Rest should fail
            await dnp.withdraw(darknode1, dai.address);
            const balanceAfterSecond = await dai.balanceOf.call(accounts[1]);
            balanceAfterSecond.should.be.bignumber.eq(balanceAfter);
        });

        it("cannot tick if it is blacklisted", async () => {
            // Should succeed if not blacklisted
            await tick(darknode2);

            await slasher.blacklist(darknode2);

            // Change the epoch
            await waitForEpoch(dnr);

            // Tick should fail
            await tick(darknode2).should.be.rejectedWith(
                /DarknodePayment: darknode is not registered/
            );
        });

        it("can still withdraw allocated rewards when blacklisted", async () => {
            // Change the epoch
            await waitForEpoch(dnr);
            // Change the epoch
            await waitForEpoch(dnr);
            // Add rewards into the next cycle's pool
            const previousBalance = new BN(
                await dnp.darknodeBalances.call(darknode3, dai.address)
            );
            const rewards = new BN("300000000000000000");
            await depositDai(rewards);
            // Change the epoch
            await waitForEpoch(dnr);
            const rewardPool = await asRewardPoolBalance(
                await store.availableBalance.call(dai.address)
            );

            // Claim the rewards for the pool
            await tick(darknode3);

            const numDarknodes = new BN(
                await dnr.numDarknodesPreviousEpoch.call()
            );
            const rewardSplit = rewardPool.div(numDarknodes);

            // Claim rewards for past cycle
            await slasher.blacklist(darknode3);

            const newBalances = new BN(
                await dnp.darknodeBalances.call(darknode3, dai.address)
            );
            newBalances.should.bignumber.equal(
                previousBalance.add(rewardSplit)
            );

            const oldDaiBal = new BN(await dai.balanceOf.call(darknode3));
            await withdraw(darknode3);
            const newDaiBal = new BN(await dai.balanceOf.call(darknode3));
            newDaiBal.should.bignumber.equal(oldDaiBal.add(newBalances));
        });
    });

    describe("Transferring ownership", async () => {
        it("should disallow unauthorized transferring of ownership", async () => {
            await dnp
                .transferStoreOwnership(accounts[1], { from: accounts[1] })
                .should.be.rejectedWith(/Ownable: caller is not the owner/);
            await dnp
                .claimStoreOwnership({ from: accounts[1] })
                .should.be.rejectedWith(
                    /Claimable: caller is not the pending owner/
                );
        });

        it("can transfer ownership of the darknode payment store", async () => {
            const newDarknodePayment = await DarknodePayment.new(
                "",
                dnr.address,
                store.address,
                0
            );

            // [ACTION] Initiate ownership transfer to wrong account
            await dnp.transferStoreOwnership(newDarknodePayment.address, {
                from: accounts[0]
            });

            // [CHECK] Owner should still be dnp
            (await store.owner.call()).should.equal(newDarknodePayment.address);

            // [RESET] Initiate ownership transfer back to dnp
            await newDarknodePayment.transferStoreOwnership(dnp.address);

            // [CHECK] Owner should now be the dnp
            (await store.owner.call()).should.equal(dnp.address);
        });
    });

    describe("DarknodePaymentStore negative tests", async () => {
        // Transfer the ownership to owner
        before(async () => {
            const claimer = await Claimer.new(store.address);
            // [ACTION] Can correct ownership transfer
            await dnp.transferStoreOwnership(claimer.address);
            // [ACTION] Claim ownership
            await claimer.transferStoreOwnership(owner);
            await store.claimOwnership({ from: owner });
            // [CHECK] Owner should now be main account
            (await store.owner.call()).should.equal(owner);
        });

        it("cannot increment balances by an invalid amounts", async () => {
            await store
                .incrementDarknodeBalance(darknode1, dai.address, 0)
                .should.be.rejectedWith(/DarknodePaymentStore: invalid amount/);
            const invalidAmount = new BN(
                await store.availableBalance.call(dai.address)
            ).add(new BN(1));
            await store
                .incrementDarknodeBalance(darknode1, dai.address, invalidAmount)
                .should.be.rejectedWith(
                    /DarknodePaymentStore: insufficient contract balance/
                );
        });

        it("cannot transfer more than is in the balance", async () => {
            const invalidAmount = new BN(
                await dnp.darknodeBalances.call(darknode1, dai.address)
            ).add(new BN(1));
            await store
                .transfer(darknode1, dai.address, invalidAmount, darknode1)
                .should.be.rejectedWith(
                    /DarknodePaymentStore: insufficient darknode balance/
                );
        });

        it("cannot call functions from non-owner", async () => {
            await store
                .incrementDarknodeBalance(darknode1, dai.address, new BN(0), {
                    from: accounts[2]
                })
                .should.be.rejectedWith(/Ownable: caller is not the owner/);
            await store
                .transfer(darknode1, dai.address, new BN(0), darknode1, {
                    from: accounts[2]
                })
                .should.be.rejectedWith(/Ownable: caller is not the owner/);
            await store
                .transferOwnership(dnp.address, { from: accounts[2] })
                .should.be.rejectedWith(/Ownable: caller is not the owner/);
        });

        it("cannot transferOwnership to the same owner", async () => {
            await store
                .transferOwnership(owner, { from: owner })
                .should.be.rejectedWith(/Claimable: invalid new owner/);
            await store.transferOwnership(accounts[3], { from: owner });
            await store
                .transferOwnership(accounts[3], { from: owner })
                .should.be.rejectedWith(/Claimable: invalid new owner/);
        });

        // Transfer the ownership back to DNP
        after(async () => {
            // [RESET] Initiate ownership transfer back to dnp
            await store.transferOwnership(dnp.address);
            // [RESET] Claim ownership
            await dnp.claimStoreOwnership();
            // [CHECK] Owner should now be the dnp
            (await store.owner.call()).should.equal(dnp.address);
        });
    });

    describe("when updating cycle changer", async () => {
        it("cannot update cycleChanger if unauthorized", async () => {
            await dnp
                .updateCycleChanger(accounts[2], { from: accounts[2] })
                .should.be.rejectedWith(/Ownable: caller is not the owner./);
            await dnp
                .updateCycleChanger(accounts[3], { from: accounts[3] })
                .should.be.rejectedWith(/Ownable: caller is not the owner./);
        });

        it("cannot update cycleChanger to an invalid address", async () => {
            await dnp
                .updateCycleChanger(NULL)
                .should.be.rejectedWith(/invalid contract address/);
        });

        it("can update cycleChanger to different address", async () => {
            await dnp.updateCycleChanger(accounts[2]);
            await dnp.changeCycle({ from: accounts[2] });
            await dnp
                .changeCycle()
                .should.be.rejectedWith(/DarknodePayment: not cycle changer/);
            // Restore the cycle changer to the dnr address
            await dnp.updateCycleChanger(dnr.address);
        });
    });

    describe("when forwarding funds", async () => {
        it("can forward ETH", async () => {
            await dnp.forward(ETHEREUM);
        });

        it("can forward funds to the store", async () => {
            // DNP should have zero balance
            new BN(
                await dai.balanceOf.call(dnp.address)
            ).should.bignumber.equal(new BN(0));

            const storeDaiBalance = new BN(
                await store.availableBalance.call(dai.address)
            );
            const amount = new BN("1000000");
            new BN(await dai.balanceOf.call(owner)).gte(amount).should.be.true;
            await dai.transfer(dnp.address, amount);

            (
                await store.availableBalance.call(dai.address)
            ).should.bignumber.equal(storeDaiBalance);
            // DNP should have some balance
            new BN(
                await dai.balanceOf.call(dnp.address)
            ).should.bignumber.equal(amount);

            // Forward the funds on
            await dnp.forward(dai.address);
            new BN(
                await dai.balanceOf.call(dnp.address)
            ).should.bignumber.equal(new BN(0));
            (
                await store.availableBalance.call(dai.address)
            ).should.bignumber.equal(storeDaiBalance.add(amount));
        });
    });

    describe("when changing payout percent", async () => {
        it("cannot change payout percent unless authorized", async () => {
            await dnp
                .updatePayoutPercentage(new BN(10), { from: accounts[2] })
                .should.be.rejectedWith(/Ownable: caller is not the owner./);
        });

        it("cannot change payout percent to an invalid percent", async () => {
            await dnp
                .updatePayoutPercentage(new BN(101))
                .should.be.rejectedWith(/DarknodePayment: invalid percent/);
            await dnp
                .updatePayoutPercentage(new BN(201))
                .should.be.rejectedWith(/DarknodePayment: invalid percent/);
            await dnp
                .updatePayoutPercentage(new BN(255))
                .should.be.rejectedWith(/DarknodePayment: invalid percent/);
            await dnp
                .updatePayoutPercentage(new BN(256))
                .should.be.rejectedWith(/DarknodePayment: invalid percent/);
            await dnp
                .updatePayoutPercentage(new BN(32782))
                .should.be.rejectedWith(/DarknodePayment: invalid percent/);
        });

        it("can change payout percent to a valid percent", async () => {
            await updatePayoutPercent(new BN(100));
            await updatePayoutPercent(new BN(0));
            await updatePayoutPercent(new BN(10));
            await updatePayoutPercent(new BN(12));
            await updatePayoutPercent(new BN(73));
        });

        it("should not payout anything if payout percent is zero", async () => {
            new BN(await dnp.currentCycleRewardPool.call(dai.address)).gte(
                new BN(0)
            ).should.be.true;
            const oldBal = new BN(
                await dnp.darknodeBalances.call(darknode1, dai.address)
            );
            await updatePayoutPercent(new BN(0));
            // current epoch payment amount is zero but previous is not
            await waitForEpoch(dnr);
            // now the current and previous payment amount should be zero
            // claiming the rewards for last epoch should be zero
            await tick(darknode1);
            const newBal = new BN(
                await dnp.darknodeBalances.call(darknode1, dai.address)
            );
            newBal.should.bignumber.equal(oldBal);
        });

        it("should payout the correct amount", async () => {
            new BN(await dnp.currentCycleRewardPool.call(dai.address)).gte(
                new BN(0)
            ).should.be.true;
            const oldBal = new BN(
                await dnp.darknodeBalances.call(darknode1, dai.address)
            );
            const percent = new BN(20);
            await updatePayoutPercent(percent);
            // current epoch payment amount is twenty but previous is not
            await waitForEpoch(dnr);
            // now the current and previous payment amount should be twenty
            // claiming the rewards for last epoch should be twenty percent
            const rewardPool = new BN(
                await store.availableBalance.call(dai.address)
            )
                .div(new BN(100))
                .mul(percent);
            const rewardShare = rewardPool.div(
                new BN(await dnr.numDarknodes.call())
            );
            await tick(darknode1);
            const newBal = new BN(
                await dnp.darknodeBalances.call(darknode1, dai.address)
            );
            newBal.should.bignumber.equal(oldBal.add(rewardShare));
            await updatePayoutPercent(config.DARKNODE_PAYOUT_PERCENT);
            await waitForEpoch(dnr);
        });
    });

    it("can update DarknodeRegistry", async () => {
        const darknodeRegistry = await dnp.darknodeRegistry.call();
        await dnp
            .updateDarknodeRegistry(NULL)
            .should.be.rejectedWith(
                /DarknodePayment: invalid Darknode Registry address/
            );

        await dnp.updateDarknodeRegistry(accounts[0]);
        await dnp.updateDarknodeRegistry(darknodeRegistry);
    });

    const tick = async (address: string) => {
        return dnp.claim(address);
    };

    const multiTick = async (start = 1, numberOfDarknodes = 1) => {
        for (let i = start; i < start + numberOfDarknodes; i++) {
            await tick(accounts[i]);
        }
    };

    const withdraw = async (address: string) => {
        // Our claimed amount should be positive
        const earnedDAIRewards = new BN(
            await dnp.darknodeBalances.call(address, dai.address)
        );
        earnedDAIRewards.gt(new BN(0)).should.be.true;

        const oldDAIBalance = new BN(await dai.balanceOf.call(address));

        await dnp.withdraw(address, dai.address);

        // Our balances should have increased
        const newDAIBalance = new BN(await dai.balanceOf.call(address));
        newDAIBalance.should.bignumber.equal(
            oldDAIBalance.add(earnedDAIRewards)
        );

        // We should have nothing left to withdraw
        const postWithdrawRewards = new BN(
            await dnp.darknodeBalances.call(address, dai.address)
        );
        postWithdrawRewards.should.bignumber.equal(new BN(0));
    };

    const multiWithdraw = async (start = 1, numberOfDarknodes = 1) => {
        for (let i = start; i < start + numberOfDarknodes; i++) {
            await withdraw(accounts[i]);
        }
    };

    const depositDai = async (amount: number | BN | string) => {
        const amountBN = new BN(amount);
        const previousBalance = new BN(
            await store.availableBalance.call(dai.address)
        );
        // Approve the contract to use DAI
        await dai.approve(dnp.address, amountBN);
        await dnp.deposit(amountBN, dai.address);
        // We should expect the DAI balance to have increased by what we deposited
        (await store.availableBalance.call(dai.address)).should.bignumber.equal(
            previousBalance.add(amountBN)
        );
    };

    const asRewardPoolBalance = async (
        amount: BN | string | number
    ): Promise<BN> => {
        const balance = new BN(amount);
        const payoutPercent = new BN(
            await dnp.currentCyclePayoutPercent.call()
        );
        const rewardPool = balance.div(new BN(100)).mul(payoutPercent);
        return rewardPool;
    };

    const fetchRewardPool = async (token: string): Promise<BN> => {
        return new BN(await dnp.currentCycleRewardPool.call(token));
    };

    const registerDarknode = async (i: number) => {
        await ren.transfer(accounts[i], MINIMUM_BOND);
        await ren.approve(dnr.address, MINIMUM_BOND, { from: accounts[i] });
        // Register the darknodes under the account address
        await dnr.register(accounts[i], PUBK(i), { from: accounts[i] });
    };

    const updatePayoutPercent = async (percent: number | string | BN) => {
        const p = new BN(percent);
        await dnp.updatePayoutPercentage(p);
        new BN(await dnp.nextCyclePayoutPercent.call()).should.bignumber.equal(
            p
        );
        await waitForEpoch(dnr);
        new BN(
            await dnp.currentCyclePayoutPercent.call()
        ).should.bignumber.equal(p);
    };
});
