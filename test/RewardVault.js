const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const BitcoinMock = artifacts.require("BitcoinMock");
const RepublicToken = artifacts.require("RepublicToken");
const RewardVault = artifacts.require("RewardVault");
const chai = require("chai");

chai.use(require("chai-as-promised"));
chai.should();

const MINIMUM_BOND = 100;
const MINIMUM_DARKPOOL_SIZE = 72;
const MINIMUM_EPOCH_INTERVAL = 2;


contract("Reward Vault", function (accounts) {

    let ren, dnr, rewardVault, darknode1, darknode2, darknodeOperator;
    let TOKEN1, TOKEN2, ETH;

    before(async function () {

        ren = await RepublicToken.new();
        dnr = await DarknodeRegistry.new(
            ren.address,
            MINIMUM_BOND,
            MINIMUM_DARKPOOL_SIZE,
            MINIMUM_EPOCH_INTERVAL
        );
        rewardVault = await RewardVault.new(dnr.address);

        TOKEN1 = await RepublicToken.new();
        TOKEN2 = await BitcoinMock.new();
        ETH = {
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            decimals: () => 18,
            approve: () => null,
            transfer: (to, value) => null,
            balanceOf: (address) => web3.eth.getBalance(address),
        };

        // Register all nodes
        darknode1 = accounts[8];
        darknode2 = accounts[4];

        darknodeOperator = accounts[9];

        for (const darknode of [darknode1, darknode2]) {
            await ren.transfer(darknodeOperator, MINIMUM_BOND);
            await ren.approve(dnr.address, MINIMUM_BOND, { from: darknodeOperator });
            await dnr.register(darknode, "", MINIMUM_BOND, { from: darknodeOperator });
        }
        await dnr.epoch();


        (await dnr.getOwner(darknode1))
            .should.equal(darknodeOperator);

        (await dnr.getOwner(darknode2))
            .should.equal(darknodeOperator);
    });

    it("can deposit and withdaw funds", async () => {
        let sum = {
            [darknode1]: {
                [TOKEN1.address]: 0,
                [TOKEN2.address]: 0,
                [ETH.address]: 0,
            },
            [darknode2]: {
                [TOKEN1.address]: 0,
                [TOKEN2.address]: 0,
                [ETH.address]: 0,
            }
        };

        // Deposit rewards
        for (const token of [TOKEN1, TOKEN2, ETH]) {
            const decimals = await token.decimals();
            for (let i = 0; i < accounts.length; i++) {
                for (const darknode of [darknode1, darknode2]) {
                    let fee = Math.floor(Math.random() * decimals);
                    await token.transfer(accounts[i], fee);

                    const value = token === ETH ? fee : 0;
                    await token.approve(rewardVault.address, fee, { from: accounts[i] });
                    await rewardVault.deposit(darknode, token.address, fee, { value, from: accounts[i] });
                    sum[darknode][token.address] += fee;
                }
            }
        }

        for (const token of [TOKEN1, TOKEN2, ETH]) {
            for (const darknode of [darknode1, darknode2]) {
                const balanceBefore = await token.balanceOf(darknodeOperator);
                await rewardVault.withdraw(darknode, token.address);
                const balanceAfter = await token.balanceOf(darknodeOperator);

                balanceAfter.toFixed()
                    .should.equal(balanceBefore.add(sum[darknode][token.address]).toFixed())
            }
        }
    });

});

