const Gateway = artifacts.require("Gateway");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.should();

contract("Gateway", function (accounts) {

  let gateway;

  before(async function () {
    gateway = await Gateway.new("0x261c74f7dd1ed6a069e18375ab2bee9afcb10956", "0x42a990655bffe188c9823a2f914641a32dcbb1b2", "0x8c98238c9823842a99018a2f914641a32dcbb1b2", 5);
  });

  it("can get the RepublicToken address", async () => {
    assert.equal((await gateway.republicToken.call()), "0x261c74f7dd1ed6a069e18375ab2bee9afcb10956");
  });

  it("can get the DarknodeRegistry address", async () => {
    assert.equal((await gateway.darknodeRegistry.call()), "0x42a990655bffe188c9823a2f914641a32dcbb1b2");
  });

  it("can get the TraderRegistry address", async () => {
    assert.equal((await gateway.traderRegistry.call()), "0x8c98238c9823842a99018a2f914641a32dcbb1b2");
  });

  it("can get the MinimumPodSize", async () => {
    assert.equal((await gateway.minimumPodSize.call()), 5)
  });

  it("owner can update the DarknodeRegistry address", async () => {
    await gateway.updateDarknodeRegistry("", { from: accounts[0] });
    assert.equal((await gateway.darknodeRegistry.call()), "0x0000000000000000000000000000000000000000");
  });

  it("owner can update the TraderRegistry address", async () => {
    await gateway.updateTraderRegistry("", { from: accounts[0] })
    assert.equal((await gateway.traderRegistry.call()), "0x0000000000000000000000000000000000000000");
  });

  it("owner can update the MinimumPodSize", async () => {
    await gateway.updateMinimumPodSize(10, { from: accounts[0] })
    assert.equal((await gateway.minimumPodSize.call()).toNumber(), 10)
  });

  it("anyone other than the owner cannot update the DarknodeRegistry address", async () => {
    await gateway.updateDarknodeRegistry("", { from: accounts[1] }).should.be.rejected;
  });

  it("anyone other than the owner cannot update the TraderRegistry address", async () => {
    await gateway.updateTraderRegistry("", { from: accounts[1] }).should.be.rejected;
  });

  it("anyone other than the owner cannot update the MinimumPodSize", async () => {
    await gateway.updateMinimumPodSize(10, { from: accounts[1] }).should.be.rejected;
  });

  it("the owner should be able to change the ownership of the contract", async () => {
    await gateway.transferOwnership(accounts[1], { from: accounts[0] });
    assert.equal((await gateway.owner()), accounts[1])
  })

  it("anyone other than the owner should not be able to change the ownership of the contract", async () => {
    await gateway.transferOwnership(accounts[1], { from: accounts[0] }).should.be.rejected;
  })

  it("should not be able to give the ownership to 0x0 address", async () => {
    await gateway.transferOwnership("", { from: accounts[1] }).should.be.rejected;
  })

});