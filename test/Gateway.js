const Gateway = artifacts.require("Gateway");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.should();

contract("Gateway", function(accounts) {

  let gateway;

  before(async function () {
    gateway = await Gateway.new("0x261c74f7dd1ed6a069e18375ab2bee9afcb10956", "0x42a990655bffe188c9823a2f914641a32dcbb1b2", "0x8c98238c9823842a99018a2f914641a32dcbb1b2", 5);
  });

  it("can get the RepublicToken address", async () => {
    assert.equal((await gateway.republicToken.call()),"0x261c74f7dd1ed6a069e18375ab2bee9afcb10956");
  });

  it("can get the DarkNodeRegistrar address", async () => {
    assert.equal((await gateway.darkNodeRegistrar.call()),"0x42a990655bffe188c9823a2f914641a32dcbb1b2");
  });

  it("can get the TraderRegistrar address", async () => {
    assert.equal((await gateway.traderRegistrar.call()),"0x8c98238c9823842a99018a2f914641a32dcbb1b2");
  });

  it("can get the MinimumDarkPoolSize", async () => {
    assert.equal((await gateway.minimumDarkPoolSize.call()),5)
  });

  it("owner can update the DarkNodeRegistrar address", async () => {
    await gateway.updateDarkNodeRegistrar("", {from: accounts[0]});
    assert.equal((await gateway.darkNodeRegistrar.call()),"0x0000000000000000000000000000000000000000");
  });

  it("owner can update the TraderRegistrar address", async () => {
    await gateway.updateTraderRegistrar("", {from: accounts[0]})
    assert.equal((await gateway.traderRegistrar.call()),"0x0000000000000000000000000000000000000000");
  });

  it("owner can update the MinimumDarkPoolSize", async () => {
    await gateway.updateMinimumDarkPoolSize(10, {from: accounts[0]})
    assert.equal((await gateway.minimumDarkPoolSize.call()).toNumber(),10)
  });

  it("anyone other than the owner cannot update the DarkNodeRegistrar address", async () => {
    await gateway.updateDarkNodeRegistrar("", {from: accounts[1]}).should.be.rejectedWith();
  });

  it("anyone other than the owner cannot update the TraderRegistrar address", async () => {
    await gateway.updateTraderRegistrar("", {from: accounts[1]}).should.be.rejectedWith();
  });

  it("anyone other than the owner cannot update the MinimumDarkPoolSize", async () => {
    await gateway.updateMinimumDarkPoolSize(10, {from: accounts[1]}).should.be.rejectedWith();
  });

});