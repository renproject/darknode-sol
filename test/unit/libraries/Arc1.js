// const Arc1 = artifacts.require("Arc1Test");
// const chai = require("chai");
// chai.use(require("chai-as-promised"));
// chai.use(require("chai-bignumber")());
// chai.should();

// // Unit tests for Arc1 library

// contract("Arc1", function(accounts) {

//   const secretAlice = '0x8CbaC5e4d803bE2A3A5cd3DbE7174504c6DD0c1C'
//   const keyAlice = web3.sha3(secretAlice)
//   const Alice = accounts[2];
//   const signatureAlice = web3.eth.sign(Alice, keyAlice)
  
//   const secretBob   = '0xd3DbE7174504c6DD0c1C8CbaC5e4d803bE2A3A5c'
//   const keyBob = web3.sha3(secretBob)
//   const Bob = accounts[3];
//   const signatureBob = web3.eth.sign(Bob, keyBob)

//   let swap, dualKey, dualSigAlice;

//   before(async function () {
//     arc = await Arc1.new(keyAlice, signatureAlice, 600, 100, "", {from: Alice});
//     arcRefund = await Arc1.new(keyAlice, signatureAlice, 0, 100, "", {from: Alice});
//   });

//   it("deposit ether to the contract", async () => {
//     await arc.sendTransaction({from: Alice, value: 100});
//     await arcRefund.sendTransaction({from: Alice, value: 100});
//   })

//   it("can get the dualKey", async () => {
//     dualKey = await arc.dualKey.call(signatureAlice, signatureBob);
//   })

//   it("Alice sends the contract information to bob", async () => {
//     dualSigAlice = web3.eth.sign(Alice, dualKey);
//   })

//   it("Bob audits the contract", async () => {
//     const value = await arc.audit.call();
//     assert.equal(value[0], 0x1);
//     assert.equal(value[1].toNumber(), 100);
//   })

//   it("Bob can redeem and get ether", async () => {
//     const dualSigBob = web3.eth.sign(Bob, dualKey);
//     await arc.redeem(keyBob, signatureBob, dualSigAlice, dualSigBob, {from: Bob});
//     const pair = await arc.auditSecret();
//     assert.equal(pair[0], dualSigAlice);
//     assert.equal(pair[1], dualSigBob);
//   })

//   it("Alice can refund her ether after expiry", async () => {
//     await arcRefund.refund("", 100).should.be.rejectedWith();
//   })

// });