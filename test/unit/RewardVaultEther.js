const RewardVaultEther = artifacts.require("RewardVaultEther");
const DarkNodeRegistry = artifacts.require("DarkNodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

contract("RewardVaultEther", function(accounts) {

  let rve, dnr, ren;

  before(async function () {
    ren = await RepublicToken.new();
    dnr = await DarkNodeRegistry.new(ren.address, 100, 72, 3);
    rve = await RewardVaultEther.new(5, 5, 100, dnr.address);
    for (i = 1; i < accounts.length; i++) { 
      await ren.transfer(accounts[i], 100);
    }
    for (i = 0; i < accounts.length; i++) { 
        uid = (i+1).toString();
        await ren.approve(dnr.address, 100, {from: accounts[i]});
        await dnr.register(uid, uid, 100, {from: accounts[i]});
    }
    await new Promise((resolve, reject) => setTimeout(async () => {
        try {
          await dnr.epoch();
          for (i = 0; i < accounts.length; i++) { 
            uid = (i+1).toString();
            assert.equal((await dnr.isRegistered(uid)), true);
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 6 * 1000));
  });

  it("should deposit ether", async() => {
    for (i = 0; i < 10; i++) {
      await rve.Deposit("Order"+i, {value: 10});
    }
  })

  it("should be able to finalize a reward round", async() => {
    await rve.Finalize(0);
  })

  it("should be able to withdraw reward", async() => {
    const rewardees = await rve.getRewardees(0);
    await rve.Withdraw("Order"+0, "", 0, {from: rewardees[0]});
  })

});