
// import * as chai from "chai";
// chai.use(require("chai-as-promised"));
// chai.use(require("chai-bignumber")());
// chai.should();

// import * as utils from "./_helpers/test_utils";
// import { accounts } from "./_helpers/accounts";
// import steps from "./_steps/steps";

// contract("DarkNode Registar (multiple dark nodes)", function () {

//   afterEach("ensure dark nodes are all deregistered", async function () {
//     // Reset after each test
//     await steps.WaitForEpoch();
//   });

//   it("can retrieve a list of all dark nodes", async function () {
//     await steps.RegisterDarkNode(accounts[0], 1000);
//     await steps.WaitForEpoch();
//     (await steps.GetRegisteredAccountIndexes())
//       .should.deep.equal([0]);

//     await steps.RegisterDarkNode(accounts[1], 1000);
//     await steps.WaitForEpoch();
//     (await steps.GetRegisteredAccountIndexes())
//       .should.deep.equal([0, 1]);

//     await steps.DeregisterDarkNode(accounts[0]);
//     await steps.WaitForEpoch();
//     (await steps.GetRegisteredAccountIndexes())
//       .should.deep.equal([1]);

//     await steps.DeregisterDarkNode(accounts[1]);
//     await steps.WaitForEpoch();
//     (await steps.GetRegisteredAccountIndexes())
//       .should.deep.equal([]);

//     await steps.WithdrawDarkNodeBonds(accounts.slice(0, 2));
//   });

//   it("can manage several dark nodes registering and deregistering", async function () {
//     await steps.RegisterDarkNode(accounts[0], 1000);
//     await steps.RegisterDarkNode(accounts[3], 1000);
//     await steps.WaitForEpoch();
//     (await steps.GetRegisteredAccountIndexes())
//       .should.deep.equal([0, 3]);

//     await steps.DeregisterDarkNode(accounts[3]);
//     await steps.WaitForEpoch();
//     (await steps.GetRegisteredAccountIndexes())
//       .should.deep.equal([0]);

//     await steps.RegisterDarkNode(accounts[1], 1000);
//     await steps.RegisterDarkNode(accounts[2], 1000);
//     await steps.DeregisterDarkNode(accounts[1]);
//     await steps.WaitForEpoch();
//     (await steps.GetRegisteredAccountIndexes())
//       .should.deep.equal([0, 2]);

//     await steps.DeregisterDarkNode(accounts[2]);
//     await steps.WaitForEpoch();
//     (await steps.GetRegisteredAccountIndexes())
//       .should.deep.equal([0]);

//     await steps.DeregisterDarkNode(accounts[0]);
//     await steps.WaitForEpoch();
//     (await steps.GetRegisteredAccountIndexes())
//       .should.deep.equal([]);

//     await steps.WithdrawDarkNodeBonds(accounts.slice(0, 4));
//   });

//   it("can get next dark node count", async function () {
//     await steps.RegisterDarkNode(accounts[0], 1000);
//     await steps.RegisterDarkNode(accounts[1], 1000);

//     (await steps.GetCurrentDarkNodeCount())
//       .should.be.bignumber.equal(0);

//     await steps.WaitForEpoch();

//     (await steps.GetCurrentDarkNodeCount())
//       .should.be.bignumber.equal(2);

//     await steps.DeregisterDarkNodes(accounts.slice(0, 2));
//     await steps.WithdrawDarkNodeBonds(accounts.slice(0, 2));
//   });

//   // Log costs
//   after("log costs", () => {
//     utils.printCosts();
//   });

// });