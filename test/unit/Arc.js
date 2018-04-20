const Arc = artifacts.require("Arc");
const Sha256 = require("crypto-js/sha256");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

// Unit tests for the Arc library

contract("Arc", function (accounts) {

  const secret = 'Secret'
  const secretLock = `0x${Sha256(secret).toString()}`;
  const Alice = accounts[2];
  const Bob = accounts[3];

  before(async function () {
    arc = await Arc.new(secretLock, 0x0, 100, 600, Bob, { from: Alice });
    arcRefund = await Arc.new(secretLock, 0x0, 100, 0, Bob, { from: Alice });
  });

  it("Alice deposit ether to the contract", async () => {
    await arc.sendTransaction({ from: Alice, value: 100 });
    await arcRefund.sendTransaction({ from: Alice, value: 100 });
  })

  it("Bob audits the contract", async () => {
    const audit = await arc.audit.call();
    assert.equal(audit[0], secretLock);
    assert.equal(audit[1], 0x1); // Token
    assert.equal(audit[2], Bob); // Receiver
    assert.equal(audit[3].toNumber(), 100); // Value
    // assert.equal(audit[3].toNumber(), 100); // Expiry
  })

  it("Bob can redeem and get ether", async () => {
    await arc.redeem("Random String").should.be.rejectedWith();
  })

  it("Alice can not refund herself before expiry", async () => {
    await arc.refund(0x1, 100, { from: Alice }).should.be.rejectedWith();
  })

  it("Bob can redeem and get ether", async () => {
    await arc.redeem(secret);
  })

  it("Alice can not refund herself after Bob redeemed", async () => {
    await arc.refund(0x1, 100, { from: Alice }).should.be.rejectedWith();
  })


  it("Alice can read the secret", async () => {
    const auditSecret = await arc.auditSecret();
    assert.equal(secret, web3.toAscii(auditSecret));
  })

  it("Alice can refund herself", async () => {
    await arcRefund.refund(0x2, 100, { from: Alice }).should.be.rejectedWith();
  })

  it("Alice can refund herself", async () => {
    await arcRefund.refund(0x1, 100, { from: Alice });
  })

  it("Bob can not redeem after alce refunded", async () => {
    await arcRefund.redeem(secret).should.be.rejectedWith();
  })

  it("No one should be able to audit after the swap", async () => {
    await arc.audit.call().should.be.rejectedWith();
  })
});