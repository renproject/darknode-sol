const Arc = artifacts.require("Arc");
const Token = artifacts.require("RepublicToken");
const Sha256 = require("crypto-js/sha256");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();


// User Story 2: 

/**
 *  Alice and bob want to do an atomic swap, from ether to erc20 using a dualSig Atomic Swap.
 * 
 *  * Bob tries to steal Alice's tokens *
 * 
 */


contract("Arc", function (accounts) {

  const secretBytes = Sha256('secret');
  const secret = `0x${secretBytes.toString()}`;
  const secretLock = `0x${Sha256(secretBytes).toString()}`;
  const Alice = accounts[2];
  const Bob = accounts[3];

  before(async function () {
    tokenA = await Token.new({ from: Alice });
    arcAlice = await Arc.new(secretLock, tokenA.address, 100, 0, Bob, { from: Alice });
  });

  it("Alice deposit ether to the contract", async () => {
    await tokenA.transfer(arcAlice.address, 100, { from: Alice });
  })

  it("Alice audits the contract", async () => {
    // No contract
  })

  it("Alice refunds and her tokens", async () => {
    await arcAlice.refund(tokenA.address, 100, { from: Alice });
  })

});