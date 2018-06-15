// const RewardVault = artifacts.require("RewardVault");
// const DarknodeRegistry = artifacts.require("DarknodeRegistry");
// const RepublicToken = artifacts.require("RepublicToken");
// const chai = require("chai");
// chai.use(require("chai-as-promised"));
// chai.should();

// contract("RewardVault", function (accounts) {

//   let rv, dnr, ren;

//   before(async function () {
//     ren = await RepublicToken.new();
//     dnr = await DarknodeRegistry.new(ren.address, 100, 72, 0);
//     rv = await RewardVault.new(5, 5, 100, dnr.address, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");
//     rverc20 = await RewardVault.new(5, 5, 100, dnr.address, ren.address);
//     for (i = 1; i < accounts.length; i++) {
//       await ren.transfer(accounts[i], 200);
//     }
//     for (i = 0; i < accounts.length; i++) {
//       uid = (i + 1).toString();
//       await ren.approve(dnr.address, 100, { from: accounts[i] });
//       await dnr.register(uid, uid, 100, { from: accounts[i] });
//     }

//     await dnr.epoch();
//     for (i = 0; i < accounts.length; i++) {
//       uid = (i + 1).toString();
//       assert.equal((await dnr.isRegistered(uid)), true);
//     }

//   });

//   it("should be able to deposit ether", async () => {
//     for (i = 0; i < 10; i++) {
//       await rv.deposit("Order" + i, 10, { value: 10 });
//     }
//   })

//   it("should be able to finalize a reward round", async () => {
//     await rv.finalize(0);
//   })

//   it("should be able to withdraw reward", async () => {
//     const rewardees = await rv.rewardees(0);
//     const challenges = await rv.challengeIds(0);
//     await rv.withdraw(challenges[0], "", 0, { from: rewardees[0] });
//   })

//   it("should be able to deposit erc20", async () => {
//     for (i = 0; i < 10; i++) {
//       await ren.approve(rverc20.address, 10);
//       await rverc20.deposit("Order" + i, 10);
//     }
//   })

//   it("should be able to finalize a reward round", async () => {
//     await rverc20.finalize(0);
//   })

//   it("should be able to withdraw reward", async () => {
//     const rewardees = await rverc20.rewardees(0);
//     const challenges = await rverc20.challengeIds(0);
//     await rverc20.withdraw(challenges[0], "", 0, { from: rewardees[0] });
//   })

// });