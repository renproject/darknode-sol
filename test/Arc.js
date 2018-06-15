// const Arc = artifacts.require("Arc");
// const RewardVault = artifacts.require("RewardVault");
// const RewardGateway = artifacts.require("RewardGateway");
// const DarknodeRegistry = artifacts.require("DarknodeRegistry");
// const RepublicToken = artifacts.require("RepublicToken");
// const Sha256 = require('crypto-js/sha256');
// const Keccak256 = require('js-sha3').keccak256;
// const chai = require("chai");
// chai.use(require("chai-as-promised"));
// chai.should();

// // Unit tests for the Arc library

// contract("Arc", function (accounts) {

//   const ETHEREUM = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
//   const secret = `0x${Sha256('Secret').toString()}`;
//   const secretLock = `0x${Sha256(Sha256('Secret')).toString()}`;

//   const orderAlice = 'OrderAlice'
//   const orderBob = 'OrderBob'
//   const orderAliceRefund = 'OrderAliceRefund'
//   const orderBobRefund = 'OrderBobRefund'

//   const orderNegative = 'OrderNegative'

//   const orderIdAlice = `0x${Keccak256(orderAlice)}`
//   const orderIdBob = `0x${Keccak256(orderBob)}`
//   const orderIdAliceRefund = `0x${Keccak256(orderAliceRefund)}`
//   const orderIdBobRefund = `0x${Keccak256(orderBobRefund)}`

//   const Alice = accounts[2];
//   const Bob = accounts[3];
//   const Charlie = accounts[4];

//   var ren, dnr, rv, rverc20, rvGateway, arc, arcERC20, arcERC20Refund, arcRefund;

//   before(async function () {
//     ren = await RepublicToken.new();
//     dnr = await DarknodeRegistry.new(ren.address, 100, 72, 0);
//     rv = await RewardVault.new(
//       5,
//       5,
//       100,
//       dnr.address,
//       ETHEREUM
//     );
//     rverc20 = await RewardVault.new(5, 5, 100, dnr.address, ren.address);
//     rvGateway = await RewardGateway.new();

//     // Distributing REN tokens
//     for (i = 1; i < accounts.length; i++) {
//       await ren.transfer(accounts[i], 100000);
//     }

//     // Registring Dark Nodes
//     for (i = 0; i < accounts.length; i++) {
//       uid = (i + 1).toString();
//       await ren.approve(dnr.address, 100, { from: accounts[i] });
//       await dnr.register(uid, uid, 100, { from: accounts[i] });
//     }

//     await dnr.epoch();
//     for (i = 0; i < accounts.length; i++) {
//       uid = (i + 1).toString();
//       assert.equal(await dnr.isRegistered(uid), true);
//     }

//     await rvGateway.updateRewardVault(ETHEREUM, rv.address);
//     await rvGateway.updateRewardVault(ren.address, rverc20.address);

//     arc = await Arc.new(rvGateway.address);
//   });

//   it("Alice initiates an atomic swap", async () => {
//     await arc.initiate(secretLock, ETHEREUM, 1000, 2, Date.now() + 600, Bob, orderAlice, { from: Alice, value: 1000 });
//     await arc.initiate(secretLock, ETHEREUM, 1000, 2, 0, Bob, orderAliceRefund, { from: Alice, value: 1000 });
//   })

//   it("Bob initiates an atomic swap", async () => {
//     await ren.approve(arc.address, 2000, { from: Bob });
//     await arc.initiate(secretLock, ren.address, 1000, 2, Date.now() + 600, Alice, orderBob, { from: Bob });
//     await arc.initiate(secretLock, ren.address, 1000, 2, 0, Alice, orderBobRefund, { from: Bob });
//   })

//   it("Bob should not be able to initiate an atomic swap with out proper allowance", async () => {
//     await ren.approve(arc.address, 999, { from: Bob });
//     await arc.initiate(secretLock, ren.address, 1000, 2, Date.now() + 600, Alice, orderNegative, { from: Bob }).should.be.rejectedWith();
//     await arc.initiate(secretLock, ren.address, 999, 2, 0, Alice, orderNegative, { from: Bob });
//   })

//   it("Bob audits the contract", async () => {
//     const audit = await arc.audit.call(orderIdAlice);
//     assert.equal(audit[0], secretLock);
//     assert.equal(audit[1], ETHEREUM.toLowerCase()); // Token
//     assert.equal(audit[2], Bob); // Receiver
//     assert.equal(audit[3].toNumber(), 998); // Value
//     // assert.equal(audit[3].toNumber(), 100); // Expiry
//   })

//   it("Alice audits the contract", async () => {
//     const audit = await arc.audit.call(orderIdBob);
//     assert.equal(audit[0], secretLock);
//     assert.equal(audit[1], ren.address); // Token
//     assert.equal(audit[2], Alice); // Receiver
//     assert.equal(audit[3].toNumber(), 998); // Value
//     // assert.equal(audit[3].toNumber(), 100); // Expiry
//   })

//   it("Bob can not redeem and get ether", async () => {
//     await arc.redeem(orderIdAlice, "Random String", { from: Bob }).should.be.rejectedWith();
//   })

//   it("Alice can not refund herself before expiry", async () => {
//     await arc.refund(orderIdAlice, ETHEREUM, 100, { from: Alice }).should.be.rejectedWith();
//   })

//   it("Alice can not redeem and get ether", async () => {
//     await arc.redeem(orderIdBob, "Random String", { from: Alice }).should.be.rejectedWith();
//   })

//   it("Bob can not refund himself before expiry", async () => {
//     await arc.refund(orderIdBob, ren.address, 100, { from: Bob }).should.be.rejectedWith();
//   })

//   it("Bob can not redeem and get erc20 tokens", async () => {
//     await arc.redeem(orderIdBob, secret, { from: Bob }).should.be.rejectedWith();
//   })

//   it("Alice can redeem and get erc20 tokens", async () => {
//     await arc.redeem(orderIdBob, secret, { from: Alice });
//   })

//   it("Alice can not redeem and get ether", async () => {
//     await arc.redeem(orderIdAlice, secret, { from: Alice }).should.be.rejectedWith();
//   })

//   it("Bob can redeem and get ether", async () => {
//     await arc.redeem(orderIdAlice, secret, { from: Bob });
//   })


//   it("Alice can not refund herself after Bob redeemed", async () => {
//     await arc.refund(orderIdAlice, ETHEREUM, 100, { from: Alice }).should.be.rejectedWith();
//   })

//   it("Bob can not refund herself after Bob redeemed", async () => {
//     await arc.refund(orderIdBob, ren.address, 100, { from: Bob }).should.be.rejectedWith();
//   })

//   it("Alice can read the secret", async () => {
//     const auditSecret = await arc.auditSecret(orderIdAlice, { from: Alice });
//     assert.equal(secret, auditSecret);
//   })

//   it("Bob can read the secret", async () => {
//     const auditSecret = await arc.auditSecret(orderIdBob, { from: Bob });
//     assert.equal(secret, auditSecret);
//   })

//   it("should be able to audit after the swap/refund", async () => {
//     await arc.audit.call(orderIdAlice, { from: Charlie }).should.be.rejectedWith();
//   })

//   it("Alice can not refund herself with tokens she does not have", async () => {
//     await arc.refund(orderIdAlice, 0x2, 1000, { from: Alice }).should.be.rejectedWith();
//   })

//   it("Bob can not refund alice's contract", async () => {
//     await arc.refund(orderIdAlice, ETHEREUM, 1000, { from: Bob }).should.be.rejectedWith();
//   })


//   it("Alce can not refund bob's contract", async () => {
//     await arc.refund(orderIdBobRefund, ren.address, 1000, { from: Alice }).should.be.rejectedWith();
//   })


//   it("Alice can refund herself", async () => {
//     await arc.refund(orderIdAliceRefund, ETHEREUM, 1000, { from: Alice });
//   })


//   it("Bob can refund himself", async () => {
//     await arc.refund(orderIdBobRefund, ren.address, 1000, { from: Bob });
//   })


//   it("Bob can not redeem after alice refunded", async () => {
//     await arc.redeem(orderIdAlice, secret, { from: Bob }).should.be.rejectedWith();
//   })

//   it("Alice can not redeem after bob refunded", async () => {
//     await arc.redeem(orderIdBobRefund, secret, { from: Alice }).should.be.rejectedWith();
//   })

//   it("should be able to audit after the swap/refund", async () => {
//     await arc.audit.call(orderIdAlice, { from: Bob }).should.be.rejectedWith();
//     await arc.audit.call(orderIdBob, { from: Alice }).should.be.rejectedWith();
//     await arc.audit.call(orderIdAliceRefund, { from: Bob }).should.be.rejectedWith();
//     await arc.audit.call(orderIdBobRefund, { from: Alice }).should.be.rejectedWith();
//   })

//   it("should fail to audit secret after refund", async () => {
//     await arc.auditSecret.call(orderIdAliceRefund, { from: Alice }).should.be.rejectedWith();
//     await arc.auditSecret.call(orderIdBobRefund, { from: Bob }).should.be.rejectedWith();
//   })
// });