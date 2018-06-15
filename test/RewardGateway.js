// const RewardVault = artifacts.require("RewardVault");
// const RewardGateway = artifacts.require("RewardGateway");
// const DarknodeRegistry = artifacts.require("DarknodeRegistry");
// const RepublicToken = artifacts.require("RepublicToken");
// const chai = require("chai");
// chai.use(require("chai-as-promised"));
// chai.should();

// contract("RewardGateway", function (accounts) {
//     const ETHEREUM = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
//     let rv, dnr, ren;

//     before(async function () {
//         ren = await RepublicToken.new();
//         dnr = await DarknodeRegistry.new(ren.address, 100, 72, 0);
//         rv = await RewardVault.new(
//             5,
//             5,
//             100,
//             dnr.address,
//             ETHEREUM
//         );
//         rverc20 = await RewardVault.new(5, 5, 100, dnr.address, ren.address);
//         rvGateway = await RewardGateway.new();
//         for (i = 1; i < accounts.length; i++) {
//             await ren.transfer(accounts[i], 200);
//         }
//         for (i = 0; i < accounts.length; i++) {
//             uid = (i + 1).toString();
//             await ren.approve(dnr.address, 100, { from: accounts[i] });
//             await dnr.register(uid, uid, 100, { from: accounts[i] });
//         }

//         await dnr.epoch();
//         for (i = 0; i < accounts.length; i++) {
//             uid = (i + 1).toString();
//             assert.equal(await dnr.isRegistered(uid), true);
//         }
//     });

//     it("should be able to add entries to the gateway contract", async () => {
//         await rvGateway.updateRewardVault(ETHEREUM, rv.address);
//         await rvGateway.updateRewardVault(ren.address, rverc20.address);
//     });

//     it("should be able to read entries from the gateway contract", async () => {
//         assert.equal(await rvGateway.rewardVaults(ETHEREUM), rv.address)
//         assert.equal(await rvGateway.rewardVaults(ren.address), rverc20.address)
//     });

// });
