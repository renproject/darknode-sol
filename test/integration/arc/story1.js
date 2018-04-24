// const Arc = artifacts.require("Arc");
// const Token = artifacts.require("RepublicToken");
// const Sha256 = require("crypto-js/sha256");
// const chai = require("chai");
// chai.use(require("chai-as-promised"));
// chai.use(require("chai-bignumber")());
// chai.should();


// // User Story 1: 

// /**
//  *  Alice and bob want to do an atomic swap, from ether to erc20 using a dualSig Atomic Swap.
//  * 
//  *  * They complete the atomic swap as expected *
//  * 
//  */


// contract("Arc", function (accounts) {

//   const secret = 'Secret'
//   const secretLock = `0x${Sha256(secret).toString()}`;
//   const Alice = accounts[2];
//   const Bob = accounts[3];

//   before(async function () {
//     tokenA = await Token.new({ from: Alice });
//     arcAlice = await Arc.new(secretLock, tokenA.address, 100, 600, Bob, { from: Alice });
//     arcBob = await Arc.new(secretLock, 0x1, 100, 0, Alice, { from: Bob });
//   });

//   it("Alice deposit ether to the contract", async () => {
//     await tokenA.transfer(arcAlice.address, 100, { from: Alice });
//     await arcBob.sendTransaction({ from: Bob, value: 100 });
//   })

//   it("Alice audits the contract", async () => {
//     const audit = await arcBob.audit.call();
//     assert.equal(audit[0], secretLock);
//     assert.equal(audit[1], 0x1); // Token
//     assert.equal(audit[2], Alice); // To
//     assert.equal(audit[3].toNumber(), 100); // Value
//   })

//   it("Bob audits the contract", async () => {
//     const audit = await arcAlice.audit.call();
//     assert.equal(audit[1], tokenA.address);
//     assert.equal(audit[2], Bob);
//     assert.equal(audit[3].toNumber(), 100);
//   })

//   it("Bob can redeem and get tokens", async () => {
//     await arcAlice.redeem(secret, { from: Bob });
//   })

//   it("Alice can read the secret", async () => {
//     const auditSecret = await arcAlice.auditSecret();
//     assert.equal(secret, web3.toAscii(auditSecret));
//   })

//   it("Alice can redeem and get ether", async () => {
//     await arcBob.redeem(secret, { from: Alice });
//   })

// });