const Arc = artifacts.require("Arc");
const Token = artifacts.require("RepublicToken");
const Sha256 = require("crypto-js/sha256");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

// Integration test for Arc library

// User Story 2: 

/**
 *  Alice and bob want to do an atomic swap, from ether to erc20 using a dualSig Atomic Swap.
 * 
 *  * Alice tries to steal Bob's ether *
 * 
 */


contract("Arc", function (accounts) {


    const secret = 'Secret'
    const secretLock = Sha256(secret).toString();
    const badSecretLock = Sha256(secret).toString();
    const Alice = accounts[2];
    const Bob = accounts[3];

    before(async function () {
        tokenA = await Token.new({ from: Alice });
        arcAlice = await Arc.new("0x" + badSecretLock, tokenA.address, 100, 600, Bob, { from: Alice });
        arcBob = await Arc.new("0x" + secretLock, 0x1, 100, 0, Alice, { from: Bob });
    });

    it("Alice deposit ether to the contract", async () => {
        await tokenA.transfer(arcAlice.address, 100, { from: Alice });
        await arcBob.sendTransaction({ from: Bob, value: 100 });
    })

    it("Alice audits the contract", async () => {
        const audit = await arcBob.audit.call();
        assert.equal(audit[0], 0x1);
        assert.equal(audit[1].toNumber(), 100);
        assert.equal(audit[2], Alice);
    })

    it("Bob's contract audit reveals a wrong secret hash", async () => {
        const audit = await arcAlice.audit.call();
        assert.equal(audit[0], tokenA.address);
        assert.equal(audit[1].toNumber(), 100);
        assert.equal(audit[2], Bob);
    })

});
