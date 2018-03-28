const Arc1 = artifacts.require("Arc1Test");
const Token = artifacts.require("RepublicToken");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

// Integration test for Arc1 library

// User Story 1: 

/**
 *  Alice and bob want to do an atomic swap, from ether to erc20 using a dualSig Atomic Swap.
 * 
 *  * They complete the atomic swap as expected *
 * 
 */

contract("Arc1", function(accounts) {

  const secretAlice = '0x8CbaC5e4d803bE2A3A5cd3DbE7174504c6DD0c1C'
  const keyAlice = web3.sha3(secretAlice)
  const Alice = accounts[2];
  const signatureAlice = web3.eth.sign(Alice, keyAlice)
  
  const secretBob   = '0xd3DbE7174504c6DD0c1C8CbaC5e4d803bE2A3A5c'
  const keyBob = web3.sha3(secretBob)
  const Bob = accounts[3];
  const signatureBob = web3.eth.sign(Bob, keyBob)

  let swap, dualKey, dualSigAlice;

  before(async function () {
    tokenA   = await Token.new({from: Alice});
    arcAlice = await Arc1.new(keyAlice, signatureAlice, 600, 100, tokenA.address, {from: Alice});
    arcBob   = await Arc1.new(keyBob, signatureBob, 600, 100, "", {from: Bob});
  });

  it("Alice deposits token A to her contract", async () => {
    await tokenA.transfer(arcAlice.address, 100, {from: Alice});
  });

  it("Bob deposits ether to his contract", async () => {
    await arcBob.sendTransaction({from: Bob, value: 100});
  });

  it("can get the dualKey", async () => {
    dualKey = await arcAlice.dualKey.call(signatureAlice, signatureBob);
  });

  it("Alice audits Bob's contract", async () => {
    const value = await arcBob.audit.call();
    assert.equal(value[0], 0x1);
    assert.equal(value[1].toNumber(), 100);
  });

  it("Bob audits Alice's contract", async () => {
    const value = await arcAlice.audit.call();
    assert.equal(value[0], tokenA.address);
    assert.equal(value[1].toNumber(), 100);
  });

  it("Alice is happy with the audit, sends her signature to Bob", async () => {
    dualSigAlice = web3.eth.sign(Alice, dualKey);
  });

  it("Bob redeems his tokens, releasing his signature", async () => {
    const dualSigBob = web3.eth.sign(Bob, dualKey);
    await arcAlice.redeem(keyBob, signatureBob, dualSigAlice, dualSigBob, {from: Bob});
    const pair = await arcAlice.auditSecret();
    assert.equal(pair[0], dualSigAlice);
    assert.equal(pair[1], dualSigBob);
  });
  
  it("Alice redeems her ether, using the newly generated secrets", async () => {
    const pair = await arcAlice.auditSecret();
    await arcBob.redeem(keyAlice, signatureAlice, pair[1], pair[0], {from: Alice});
  });

});