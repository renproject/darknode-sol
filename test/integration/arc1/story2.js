const Arc1 = artifacts.require("Arc1Test");
const Token = artifacts.require("RepublicToken");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

// Integration test for Arc1 library

// User Story 2: 

/**
 *  Alice and bob want to do an atomic swap, from ether to erc20 using a dualSig Atomic Swap.
 * 
 *  * Bob tries to steal Alice's tokens *
 * 
 */

contract("Arc1", function(accounts) {

  const secretAlice = '0x8CbaC5e4d803bE2A3A5cd3DbE7174504c6DD0c1C'
  const keyAlice = web3.sha3(secretAlice)
  const Alice = accounts[4];
  const signatureAlice = web3.eth.sign(Alice, keyAlice)
  
  const secretBob   = '0xd3DbE7174504c6DD0c1C8CbaC5e4d803bE2A3A5c'
  const keyBob = web3.sha3(secretBob)
  const Bob = accounts[5];
  const signatureBob = web3.eth.sign(Bob, keyBob)

  let swap, dualKey, dualSigAlice;

  before(async function () {
    tokenA   = await Token.new({from: Alice});
    arcAlice = await Arc1.new(keyAlice, signatureAlice, 0, 100, tokenA.address, {from: Alice});
  });

  it("Alice deposits token A to her contract", async () => {
    await tokenA.transfer(arcAlice.address, 100, {from: Alice});
  });

  it("Alice audits Bob's contract", async () => {
    // No contract found
  });

  it("Alice is not happy with the audit, and refunds herself after expiry", async () => {
    await arcAlice.refund(tokenA.address, 100, {from: Alice});
  });

});