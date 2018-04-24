const Arc = artifacts.require("Arc");
const RewardVault = artifacts.require("RewardVault");
const RewardGateway = artifacts.require("RewardGateway");
const DarkNodeRegistry = artifacts.require("DarkNodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const Sha256 = require("crypto-js/sha256");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

// Unit tests for the Arc library

contract("Arc", function (accounts) {

  const ETHEREUM = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const secret = 'Secret'
  const secretLock = `0x${Sha256(secret).toString()}`;
  const orderAlice = 'OrderAlice'
  const orderBob = 'OrderBob'
  const Alice = accounts[2];
  const Bob = accounts[3];
  const Charlie = accounts[3];

  var ren, dnr, rv, rverc20, rvGateway, arc, arcERC20, arcERC20Refund, arcRefund;

  before(async function () {
    ren = await RepublicToken.new();
    dnr = await DarkNodeRegistry.new(ren.address, 100, 72, 0);
    rv = await RewardVault.new(
        5,
        5,
        100,
        dnr.address,
        ETHEREUM
    );
    rverc20 = await RewardVault.new(5, 5, 100, dnr.address, ren.address);
    rvGateway = await RewardGateway.new();

    // Distributing REN tokens
    for (i = 1; i < accounts.length; i++) {
        await ren.transfer(accounts[i], 100000);
    }

    // Registring Dark Nodes
    for (i = 0; i < accounts.length; i++) {
        uid = (i + 1).toString();
        await ren.approve(dnr.address, 100, { from: accounts[i] });
        await dnr.register(uid, uid, 100, { from: accounts[i] });
    }

    await dnr.epoch();
    for (i = 0; i < accounts.length; i++) {
        uid = (i + 1).toString();
        assert.equal(await dnr.isRegistered(uid), true);
    }

    await rvGateway.updateRewardVault(ETHEREUM, rv.address);
    await rvGateway.updateRewardVault(ren.address, rverc20.address);

    arc = await Arc.new(secretLock, ETHEREUM, 997, 2, Date.now() + 600, Bob, orderAlice, rvGateway.address, { from: Alice });
    arcRefund = await Arc.new(secretLock, ETHEREUM, 997, 2, 0, Bob, orderAlice, rvGateway.address, { from: Alice });

    arcERC20 = await Arc.new(secretLock, ren.address, 997, 2, Date.now() + 600, Alice, orderBob, rvGateway.address, { from: Bob });
    arcERC20Refund = await Arc.new(secretLock, ren.address, 997, 2, 0, Alice, orderBob, rvGateway.address, { from: Bob });

  });

  it("Alice deposit ether to the contract", async () => {
    await arc.sendTransaction({ from: Alice, value: 1000 });
    await arcRefund.sendTransaction({ from: Alice, value: 1000 });
  })

  it("Bob deposits erc20 tokens to the contract", async () => {
    await ren.transfer(arcERC20.address, 1000, {from: Bob});
    await ren.transfer(arcERC20Refund.address, 1000, {from: Bob});
  })

  it("Bob audits the contract", async () => {
    const audit = await arc.audit.call();
    assert.equal(audit[0], secretLock);
    assert.equal(audit[1], ETHEREUM.toLowerCase()); // Token
    assert.equal(audit[2], Bob); // Receiver
    assert.equal(audit[3].toNumber(), 997); // Value
    // assert.equal(audit[3].toNumber(), 100); // Expiry
  })

  it("Alice audits the contract", async () => {
    const audit = await arcERC20.audit.call();
    assert.equal(audit[0], secretLock);
    assert.equal(audit[1], ren.address); // Token
    assert.equal(audit[2], Alice); // Receiver
    assert.equal(audit[3].toNumber(), 997); // Value
    // assert.equal(audit[3].toNumber(), 100); // Expiry
  })

  it("Bob can not redeem and get ether", async () => {
    await arc.redeem("Random String", { from: Bob }).should.be.rejectedWith();
  })

  it("Alice can not refund herself before expiry", async () => {
    await arc.refund(ETHEREUM, 100, { from: Alice }).should.be.rejectedWith();
  })

  it("Alice can not redeem and get ether", async () => {
    await arcERC20.redeem("Random String", {from: Alice}).should.be.rejectedWith();
  })

  it("Bob can not refund himself before expiry", async () => {
    await arcERC20.refund(ren.address, 100, { from: Bob }).should.be.rejectedWith();
  })

  it("Alice can redeem and get erc20 tokens", async () => {
    await arcERC20.redeem(secret, {from: Alice});
  })

  it("Bob can not redeem and get erc20 tokens", async () => {
    await arcERC20.redeem(secret, {from: Bob}).should.be.rejectedWith();
  })

  it("Bob can redeem and get ether", async () => {
    await arc.redeem(secret, {from: Bob});
  })

  it("Alice can not redeem and get ether", async () => {
    await arc.redeem(secret, {from: Alice}).should.be.rejectedWith();
  })

  it("Alice can not refund herself after Bob redeemed", async () => {
    await arc.refund(ETHEREUM, 100, { from: Alice }).should.be.rejectedWith();
  })

  it("Bob can not refund herself after Bob redeemed", async () => {
    await arcERC20.refund(ren.address, 100, { from: Bob }).should.be.rejectedWith();
  })

  it("Alice can read the secret", async () => {
    const auditSecret = await arc.auditSecret({from: Alice});
    assert.equal(secret, web3.toAscii(auditSecret));
  })

  it("Bob can read the secret", async () => {
    const auditSecret = await arcERC20.auditSecret({from: Bob});
    assert.equal(secret, web3.toAscii(auditSecret));
  })

  it("should be able to audit after the swap/refund", async () => {
    await arc.audit.call({from: Charlie}).should.be.rejectedWith();
  })

  it("Alice can not refund herself with tokens she does not have", async () => {
    await arcRefund.refund(0x2, 1000, { from: Alice }).should.be.rejectedWith();
  })

  it("Bob can not refund alice's contract", async () => {
    await arcRefund.refund(ETHEREUM, 1000, { from: Bob }).should.be.rejectedWith();
  })  


  it("Alce can not refund bob's contract", async () => {
    await arcERC20Refund.refund(ren.address, 1000, { from: Alice }).should.be.rejectedWith();
  })


  it("Alice can refund herself", async () => {
    await arcRefund.refund(ETHEREUM, 1000, { from: Alice });
  })  


  it("Bob can refund himself", async () => {
    await arcERC20Refund.refund(ren.address, 1000, { from: Bob });
  })


  it("Bob can not redeem after alice refunded", async () => {
    await arcRefund.redeem(secret, {from: Bob}).should.be.rejectedWith();
  })

  it("Alice can not redeem after bob refunded", async () => {
    await arcERC20Refund.redeem(secret, {from: Alice}).should.be.rejectedWith();
  })

  it("should be able to audit after the swap/refund", async () => {
    await arc.audit.call({from: Bob}).should.be.rejectedWith();
    await arcERC20.audit.call({from: Alice}).should.be.rejectedWith();
    await arcRefund.audit.call({from: Bob}).should.be.rejectedWith();
    await arcERC20Refund.audit.call({from: Alice}).should.be.rejectedWith();
  })

  it("should fail to audit secret after refund", async() => {
    await arcRefund.auditSecret.call({from: Alice}).should.be.rejectedWith();
    await arcERC20Refund.auditSecret.call({from: Bob}).should.be.rejectedWith();
  })
});