import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import moment from "moment";
import {
    ClaimlessRewardsInstance,
    DarknodePaymentInstance,
    DarknodePaymentStoreContract,
    DarknodeRegistryLogicV1Contract
} from "../../types/truffle-contracts";
import {
    ETHEREUM,
    getBalance,
    getDecimals,
    getSymbol,
    HOURS,
    increaseTime,
    NULL,
    toBN,
    transferToken,
    waitForEpoch
} from "../helper/testUtils";

const DarknodePaymentStore: DarknodePaymentStoreContract = artifacts.require(
    "DarknodePaymentStore"
);
const DarknodeRegistry: DarknodeRegistryLogicV1Contract = artifacts.require(
    "DarknodeRegistryLogicV1"
);

const registerToken = async (
    rewards: ClaimlessRewardsInstance,
    tokens: string | string[]
) => {
    tokens = Array.isArray(tokens) ? tokens : [tokens];

    for (const token of tokens) {
        // Precondition. The token is not registered.
        (await rewards.isRegistered.call(token)).should.equal(false);
        const allTokens = await rewards.getRegisteredTokens.call();

        // Effect. Register the token.
        await rewards.registerToken(token);

        // Postcondition. The token is registered.
        (await rewards.isRegistered.call(token)).should.equal(true);
        (await rewards.getRegisteredTokens.call()).should.deep.equal([
            ...allTokens,
            token
        ]);
    }
};

const deregisterToken = async (
    rewards: ClaimlessRewardsInstance,
    tokens: string | string[]
) => {
    tokens = Array.isArray(tokens) ? tokens : [tokens];

    for (const token of tokens) {
        // Precondition. The token is registered.
        (await rewards.isRegistered.call(token)).should.equal(true);
        const allTokens = await rewards.getRegisteredTokens.call();

        // Effect. Deregister the token.
        await rewards.deregisterToken(token);

        // Postcondition. The token is not registered.
        (await rewards.isRegistered.call(token)).should.equal(false);
        (await rewards.getRegisteredTokens.call()).should.deep.equal(
            allTokens.filter(x => x !== token)
        );
    }
};

const changeCycle = async (
    rewards: ClaimlessRewardsInstance,
    time: number,
    epoch?: boolean
) => {
    const latestTimestamp = await toBN(rewards.latestCycleTimestamp.call());
    const storeAddress = await rewards.store.call();
    const store = await DarknodePaymentStore.at(storeAddress);
    const dnrAddress = await rewards.darknodeRegistry.call();
    const dnr = await DarknodeRegistry.at(dnrAddress);
    const communityFund = await rewards.communityFund.call();

    const tokens = await rewards.getRegisteredTokens.call();
    let freeBeforeMap = OrderedMap<string, BigNumber>();
    let communityFundBalanceBeforeMap = OrderedMap<string, BigNumber>();
    let darknodePoolBeforeMap = OrderedMap<string, BigNumber>();
    let shareBeforeMap = OrderedMap<string, BigNumber>();
    for (const token of tokens) {
        const freeBefore = await toBN(store.availableBalance.call(token));
        freeBeforeMap = freeBeforeMap.set(token, freeBefore);

        const communityFundBalanceBefore = await toBN(
            rewards.darknodeBalances.call(communityFund, token)
        );
        communityFundBalanceBeforeMap = communityFundBalanceBeforeMap.set(
            token,
            communityFundBalanceBefore
        );
        const darknodePoolBefore = await toBN(
            rewards.darknodeBalances.call(NULL, token)
        );
        darknodePoolBeforeMap = darknodePoolBeforeMap.set(
            token,
            darknodePoolBefore
        );
        const shareBefore = await toBN(
            rewards.cycleCumulativeTokenShares.call(
                latestTimestamp.toFixed(),
                token
            )
        );
        shareBeforeMap = shareBeforeMap.set(token, shareBefore);
    }
    const shares = await toBN(dnr.numDarknodes.call());
    const epochTimestampCountBefore = await toBN(
        rewards.epochTimestampsLength.call()
    );

    // Effect. Change the cycle.
    let tx;
    if (epoch) {
        tx = await waitForEpoch(dnr);
    } else {
        await increaseTime(time);
        tx = await rewards.changeCycle();
    }

    // Postcondition. Check that the cycle's timestamp is stored correctly.
    const block = await web3.eth.getBlock(tx.receipt.blockNumber);
    const timestamp = new BigNumber(block.timestamp);
    const newLatestTimestamp = await toBN(rewards.latestCycleTimestamp.call());
    // Check if the epoch happened too recently to a cycle, so no cycle was
    // called.
    const expectedTimestamp = epoch
        ? timestamp
        : latestTimestamp.plus(
              timestamp
                  .minus(latestTimestamp)
                  .minus(timestamp.minus(latestTimestamp).mod(1 * HOURS))
          );
    newLatestTimestamp.should.not.bignumber.equal(latestTimestamp);
    newLatestTimestamp.should.bignumber.equal(expectedTimestamp);
    const epochTimestampCountAfter = await toBN(
        rewards.epochTimestampsLength.call()
    );
    if (epoch) {
        epochTimestampCountAfter.should.bignumber.equal(
            epochTimestampCountBefore.plus(1)
        );
    }

    // Postcondition. Check conditions for each token.
    const hours = timestamp
        .minus(latestTimestamp)
        .dividedToIntegerBy(1 * HOURS)
        .toNumber();
    const numerator = await toBN(rewards.hourlyPayoutWithheldNumerator.call());
    const denominator = await toBN(
        rewards.HOURLY_PAYOUT_WITHHELD_DENOMINATOR.call()
    );
    let numeratorSeries = numerator;
    for (let i = 0; i < hours; i++) {
        numeratorSeries = numeratorSeries
            .times(numerator)
            .div(denominator)
            .integerValue(BigNumber.ROUND_DOWN);
    }
    const communityFundNumerator = await toBN(
        rewards.communityFundNumerator.call()
    );

    for (const token of tokens) {
        const freeBefore = freeBeforeMap.get(token);
        const communityFundBalanceBefore = communityFundBalanceBeforeMap.get(
            token
        );
        const darknodePoolBefore = darknodePoolBeforeMap.get(token);
        const shareBefore = shareBeforeMap.get(token);

        const totalWithheld = freeBefore
            .times(numeratorSeries)
            .div(denominator)
            .integerValue(BigNumber.ROUND_DOWN);

        const totalPaidout = freeBefore.minus(totalWithheld);
        const communityFundPaidout = totalPaidout
            .times(communityFundNumerator)
            .div(denominator)
            .integerValue(BigNumber.ROUND_DOWN);

        const darknodePaidout = totalPaidout.minus(communityFundPaidout);
        const share = shares.isZero()
            ? new BigNumber(0)
            : darknodePaidout.div(shares).integerValue(BigNumber.ROUND_DOWN);

        const darknodePaidoutAdjusted = share.times(shares);

        // Postcondition. The stored share is the correct amount.
        const shareAfter = await toBN(
            rewards.cycleCumulativeTokenShares.call(
                newLatestTimestamp.toFixed(),
                token
            )
        );

        shareAfter.minus(shareBefore).should.bignumber.equal(share);

        // Postcondition. The darknode pool increased by the correct amount.
        const darknodePoolAfter = await toBN(
            rewards.darknodeBalances.call(NULL, token)
        );
        darknodePoolAfter
            .minus(darknodePoolBefore)
            .should.bignumber.equal(darknodePaidoutAdjusted);

        // Postcondition. The community fund increased by the correct amount.
        const communityFundBalanceAfter = await toBN(
            rewards.darknodeBalances.call(communityFund, token)
        );
        communityFundBalanceAfter
            .minus(communityFundBalanceBefore)
            .should.bignumber.equal(communityFundPaidout);

        // Postcondition. The free amount decreased by the correct amount.
        const freeAfter = await toBN(store.availableBalance.call(token));
        freeBefore
            .minus(freeAfter)
            .should.bignumber.equal(
                communityFundPaidout.plus(darknodePaidoutAdjusted)
            );
    }

    console.log(
        `New cycle after ${moment
            .duration(newLatestTimestamp.minus(latestTimestamp).times(1000))
            .humanize()}.`
    );

    return hours;
};

const _waitForEpoch = async (rewards: ClaimlessRewardsInstance) => {
    await changeCycle(rewards, 0, true);
};

const addRewards = async (
    rewards: ClaimlessRewardsInstance | DarknodePaymentInstance,
    token: string,
    amount: BigNumber | number | string | BN
) => {
    const storeAddress = await rewards.store.call();
    const balanceBefore = await getBalance(token, storeAddress);
    const store = await DarknodePaymentStore.at(storeAddress);
    const freeBefore = await toBN(store.availableBalance.call(token));

    // Effect. Transfer token to the store contract.
    await transferToken(token, storeAddress, amount);

    // Postcondition. The balance after has increased by the amount added.
    const balanceAfter = await getBalance(token, storeAddress);
    balanceAfter.minus(balanceBefore).should.bignumber.equal(amount);
    const freeAfter = await toBN(store.availableBalance.call(token));
    freeAfter.minus(freeBefore).should.bignumber.equal(amount);

    console.log(
        `There are now ${new BigNumber(freeAfter.toString())
            .div(new BigNumber(10).exponentiatedBy(await getDecimals(token)))
            .toFixed()} ${await getSymbol(token)} in rewards`
    );
};

const withdraw = async (
    rewards: ClaimlessRewardsInstance,
    darknodes: string | string[],
    tokens: string | string[],
    from?: string
) => {
    tokens = Array.isArray(tokens) ? tokens : [tokens];
    darknodes = Array.isArray(darknodes) ? darknodes : [darknodes];
    from = from || darknodes[0];

    // Store the balance for each token, and the withdrawable amount for each
    // darknode and token.
    let withdrawableMap = OrderedMap<string, OrderedMap<string, BigNumber>>();
    let balanceBeforeMap = OrderedMap<string, BigNumber>();
    // let legacyBalanceMap = OrderedMap<string, OrderedMap<string, BigNumber>>();
    // let shareBeforeMap = OrderedMap<string, OrderedMap<string, BigNumber>>();
    const storeAddress = await rewards.store.call();
    const store = await DarknodePaymentStore.at(storeAddress);
    const currentCycle = await toBN(rewards.latestCycleTimestamp.call());
    const dnrAddress = await rewards.darknodeRegistry.call();
    const dnr = await DarknodeRegistry.at(dnrAddress);
    for (const token of tokens) {
        const balanceBefore = await getBalance(token, from);
        balanceBeforeMap = balanceBeforeMap.set(token, balanceBefore);

        for (const darknode of darknodes) {
            const withdrawable = await toBN(
                rewards.darknodeBalances.call(darknode, token)
            );
            withdrawableMap = withdrawableMap.set(
                darknode,
                (
                    withdrawableMap.get(darknode) ||
                    OrderedMap<string, BigNumber>()
                ).set(token, withdrawable)
            );

            // Precondition. The withdrawable amount should be the correct
            // amount, including any legacy balance left-over.
            const nodeRegistered = await toBN(
                dnr.darknodeRegisteredAt.call(darknode)
            );
            const nodeDeregistered = await toBN(
                dnr.darknodeDeregisteredAt.call(darknode)
            );
            // Node not registered.
            if (nodeRegistered.isZero()) {
                continue;
            }
            const legacyBalance = await toBN(
                store.darknodeBalances.call(darknode, token)
            );
            let lastWithdrawn = await toBN(
                rewards.rewardsLastClaimed.call(darknode, token)
            );
            if (lastWithdrawn.lt(nodeRegistered)) {
                lastWithdrawn = await toBN(
                    rewards.getNextEpochFromTimestamp.call(
                        nodeRegistered.toFixed()
                    )
                );
            }
            let claimableUntil = currentCycle;
            if (nodeDeregistered.isGreaterThan(0)) {
                const deregisteredCycle = await toBN(
                    rewards.getNextEpochFromTimestamp.call(
                        nodeDeregistered.toFixed()
                    )
                );
                if (deregisteredCycle.isGreaterThan(0)) {
                    claimableUntil = deregisteredCycle;
                }
            }
            const shareBefore = await toBN(
                rewards.cycleCumulativeTokenShares.call(
                    lastWithdrawn.toFixed(),
                    token
                )
            );
            const shareAfter = await toBN(
                rewards.cycleCumulativeTokenShares.call(
                    claimableUntil.toFixed(),
                    token
                )
            );
            withdrawable
                .minus(legacyBalance)
                .should.bignumber.equal(shareAfter.minus(shareBefore));
        }
    }

    // Effect.
    let tx;
    if (tokens.length !== 1) {
        tx = await rewards.withdrawMultiple(darknodes, tokens, { from });
    } else if (darknodes.length !== 1) {
        tx = await rewards.withdrawToken(darknodes, tokens[0], { from });
    } else {
        tx = await rewards.withdraw(darknodes[0], tokens[0], { from });
    }

    // Postcondition. Check conditions for each token and darknode.
    for (const token of tokens) {
        const balanceBefore = balanceBeforeMap.get(token);

        let withdrawableSum = new BigNumber(0);
        for (const darknode of darknodes) {
            const withdrawable = withdrawableMap.get(darknode).get(token);
            withdrawableSum = withdrawableSum.plus(withdrawable);

            const postWithdrawable = await toBN(
                rewards.darknodeBalances.call(darknode, token)
            );
            postWithdrawable.should.bignumber.equal(0);

            console.log(
                `${darknode.slice(0, 8)}... withdrew ${withdrawable
                    .div(
                        new BigNumber(10).exponentiatedBy(
                            await getDecimals(token)
                        )
                    )
                    .toFixed()} ${await getSymbol(token)}`
            );
        }

        // Postcondition. The token balance of the user withdrawing increased
        // by the expected amount.
        const transactionDetails = await web3.eth.getTransaction(tx.tx);
        let gasFee = new BigNumber(0);
        if (token === ETHEREUM) {
            const { gasPrice } = transactionDetails;
            const { gasUsed } = tx.receipt;
            gasFee = new BigNumber(gasUsed).times(gasPrice);
        }
        (await getBalance(token, from)).should.bignumber.equal(
            balanceBefore.plus(withdrawableSum).minus(gasFee)
        );
    }

    if (darknodes.length && tokens.length) {
        return withdrawableMap.get(darknodes[0]).get(tokens[0]);
    } else {
        return new BigNumber(0);
    }
};

const withdrawToCommunityFund = async (
    rewards: ClaimlessRewardsInstance,
    tokens: string | string[],
    from?: string
) => {
    from = from || (await web3.eth.getAccounts())[0];
    tokens = Array.isArray(tokens) ? tokens : [tokens];

    // Store the balance for each token, and the withdrawable amount for each
    // darknode and token.
    const communityFund = await rewards.communityFund.call();
    let withdrawableMap = OrderedMap<string, BigNumber>();
    let balanceBeforeMap = OrderedMap<string, BigNumber>();
    for (const token of tokens) {
        const balanceBefore = await getBalance(token, communityFund);
        balanceBeforeMap = balanceBeforeMap.set(token, balanceBefore);

        const withdrawable = await toBN(
            rewards.darknodeBalances.call(communityFund, token)
        );
        withdrawableMap = withdrawableMap.set(token, withdrawable);
    }

    // Effect.
    const tx = await rewards.withdrawToCommunityFund(tokens);

    // Postcondition. Check conditions for each token and darknode.
    for (const token of tokens) {
        const balanceBefore = balanceBeforeMap.get(token);
        const withdrawableBefore = withdrawableMap.get(token);

        console.log(
            `Withdrew ${withdrawableBefore
                .div(
                    new BigNumber(10).exponentiatedBy(await getDecimals(token))
                )
                .toFixed()} ${await getSymbol(token)} to the community fund.`
        );

        // Postcondition. The token balance of the user withdrawing increased
        // by the expected amount.
        const transactionDetails = await web3.eth.getTransaction(tx.tx);
        let gasFee = new BigNumber(0);
        if (token === ETHEREUM && from === communityFund) {
            const { gasPrice } = transactionDetails;
            const { gasUsed } = tx.receipt;
            gasFee = new BigNumber(gasUsed).times(gasPrice);
        }
        (await getBalance(token, communityFund)).should.bignumber.equal(
            balanceBefore.plus(withdrawableBefore).minus(gasFee)
        );
        (
            await toBN(rewards.darknodeBalances.call(communityFund, token))
        ).should.bignumber.equal(0);
    }

    if (tokens.length) {
        return withdrawableMap.get(tokens[0]);
    } else {
        return new BigNumber(0);
    }
};

export const STEPS = {
    registerToken,
    deregisterToken,
    changeCycle,
    addRewards,
    withdraw,
    withdrawToCommunityFund,
    waitForEpoch: _waitForEpoch
};
