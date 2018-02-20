
// import * as chai from "chai";
// chai.use(require("chai-as-promised"));
// chai.use(require("chai-bignumber")());
// chai.should();

// import * as utils from "./_helpers/test_utils";
// import { accounts } from "./_helpers/accounts";
// import steps from "./_steps/steps";

// /**
//  * 
//  * CONFIGURE NUMBER OF MINERS IN republic-config.js
//  * 
//  * 
//  */

// contract("Miner Registar (all dark nodes)", function () {

//   afterEach("ensure dark nodes are all deregistered", async function () {
//     // Reset after each test
//     await steps.WaitForEpoch();
//     // await steps.WithdrawMinerBonds(accounts);
//   });

//   it("can register dark nodes", async function () {
//     await steps.RegisterDarkNodes(accounts, 1000);

//     // Wait for next shuffling
//     await steps.WaitForEpoch();

//     await steps.DeregisterDarkNodes(accounts);
//   });

//   it("can get M network", async () => {

//     await steps.RegisterDarkNodes(accounts, 1000);
//     await steps.WaitForEpoch();

//     // Get M Networks:
//     const mNetworks = await steps.GetMNetworks();

//     (await steps.GetMNetworkSize())
//       .should.be.bignumber.equal(mNetworks[0].length);

//     await steps.DeregisterDarkNodes(accounts);
//     await steps.WaitForEpoch();
//     await steps.WithdrawMinerBonds(accounts);
//   });

//   // Log costs
//   after("log costs", () => {
//     utils.printCosts();
//   });

// });