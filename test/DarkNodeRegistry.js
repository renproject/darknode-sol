const DarkNodeRegistry = artifacts.require("DarkNodeRegistry");
const RepublicToken = artifacts.require("RepublicToken");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

contract("DarkNodeRegistry", function(accounts) {

  let dnr, ren;

  before(async function () {
    ren = await RepublicToken.new();
    dnr = await DarkNodeRegistry.new(ren.address, 100, 72, 60);
  });

  it("can not register a Dark Node with a bond less than the minimum bond", async() => {
    await ren.approve(dnr.address, 99, {from: accounts[0]})
    await dnr.register("", "", 99).should.be.rejectedWith();
    await dnr.register("", "", 100).should.be.rejectedWith();
  })

  it("can not call epoch before the minimum time interval", async() => {
    await dnr.epoch().should.be.rejectedWith();
  })

  it("can register a Dark Node, call an epoch and check registration", async () => {
    await ren.approve(dnr.address, 100, {from: accounts[0]})
    await ren.transfer(accounts[2], 100);
    await ren.approve(dnr.address, 100, {from: accounts[2]})
    await dnr.register("0x261c74f7dd1ed6a069e18375ab2bee9afcb10956", "0x42a990655bffe188c9823a2f914641a32dcbb1b242a990655bffe188c9823a2f914641a32dcbb1b242a990655bffe188c9823a2f914641a32dcbb1b2aabbccabbc", 100)
    await dnr.register("0x75ab2bee9a1ed6a069e18375ab2bee9afcb10956", "0x75ab2bee9affe188c9823a2f914641a32dcbb1b242a990655bffe188c9823a2f914641a32dcbb1b242a990655bffe188c9823a2f914641a32dcbb1b2aabbccabbc", 100, {from: accounts[2]})
    await new Promise((resolve, reject) => setTimeout(async () => {
      try {
        await dnr.epoch()
        assert.equal((await dnr.isRegistered("0x261c74f7dd1ed6a069e18375ab2bee9afcb10956")), true)
        assert.equal((await dnr.isRegistered("0x75ab2bee9a1ed6a069e18375ab2bee9afcb10956")), true)
        resolve();
      } catch (err) {
        reject(err);
      }
    }, 90 * 1000));
  })

  it("can get the owner of the Dark Node", async () => {
    assert.equal((await dnr.getOwner("0x261c74f7dd1ed6a069e18375ab2bee9afcb10956")), accounts[0])
  }) 

  it("can get the bond of the Dark Node", async () => {
    assert.equal((await dnr.getBond("0x261c74f7dd1ed6a069e18375ab2bee9afcb10956")), 100)
  }) 

  it("can get the Public Key of the Dark Node", async () => {
    assert.equal((await dnr.getPublicKey("0x261c74f7dd1ed6a069e18375ab2bee9afcb10956")), "0x42a990655bffe188c9823a2f914641a32dcbb1b242a990655bffe188c9823a2f914641a32dcbb1b242a990655bffe188c9823a2f914641a32dcbb1b2aabbccabbc")
  }) 

  it("can deregister a Dark Node, call an epoch and check deregistration", async () => {
    await dnr.deregister("0x75ab2bee9a1ed6a069e18375ab2bee9afcb10956", {from: accounts[2]})
    await new Promise((resolve, reject) => setTimeout(async () => {
      try {
        await dnr.epoch()
        assert.equal((await dnr.isDeregistered("0x75ab2bee9a1ed6a069e18375ab2bee9afcb10956")), true)
        resolve();
      } catch (err) {
        reject(err);
      }
    }, 90 * 1000));
  })

  it("can only get the Dark Nodes that are fully registered", async () => {
    const nodes = await dnr.getDarkNodes.call()
    assert.equal(nodes.length, 1)
    assert.equal(nodes[0], "0x261c74f7dd1ed6a069e18375ab2bee9afcb10956")
  }) 

  it("should fail to refund before deregistering", async () => {
    await dnr.refund("0x261c74f7dd1ed6a069e18375ab2bee9afcb10956").should.be.rejectedWith();
  })

  it("can deregister a Dark Node, call an epoch, call refund and check deregistration", async () => {
    await dnr.deregister("0x261c74f7dd1ed6a069e18375ab2bee9afcb10956")
    await new Promise((resolve, reject) => setTimeout(async () => {
      try {
        await dnr.epoch()
        assert.equal((await dnr.isDeregistered("0x261c74f7dd1ed6a069e18375ab2bee9afcb10956")), true)
        await dnr.refund("0x261c74f7dd1ed6a069e18375ab2bee9afcb10956")
        assert.equal((await dnr.isUnregistered("0x261c74f7dd1ed6a069e18375ab2bee9afcb10956")), true)
        resolve();
      } catch (err) {
        reject(err);
      }
    }, 90 * 1000));
  })

  it("should fail to refund twice", async () => {
    await dnr.refund("0x261c74f7dd1ed6a069e18375ab2bee9afcb10956").should.be.rejectedWith();
  })

  it("should not refund for an address which is never registered", async () => {
    await dnr.refund("").should.be.rejectedWith();
  })


  // it("can get the DarkNodeRegistry address", async () => {
  //   assert.equal((await gateway.darkNodeRegistry.call()),"0x42a990655bffe188c9823a2f914641a32dcbb1b2");
  // });

  // it("can get the TraderRegistry address", async () => {
  //   assert.equal((await gateway.traderRegistry.call()),"0x8c98238c9823842a99018a2f914641a32dcbb1b2");
  // });

  // it("can get the MinimumDarkPoolSize", async () => {
  //   assert.equal((await gateway.minimumDarkPoolSize.call()),5)
  // });

  // it("owner can update the DarkNodeRegistry address", async () => {
  //   await gateway.updateDarkNodeRegistry("", {from: accounts[0]});
  //   assert.equal((await gateway.darkNodeRegistry.call()),"0x0000000000000000000000000000000000000000");
  // });

  // it("owner can update the TraderRegistry address", async () => {
  //   await gateway.updateTraderRegistry("", {from: accounts[0]})
  //   assert.equal((await gateway.traderRegistry.call()),"0x0000000000000000000000000000000000000000");
  // });

  // it("owner can update the MinimumDarkPoolSize", async () => {
  //   await gateway.updateMinimumDarkPoolSize(10, {from: accounts[0]})
  //   assert.equal((await gateway.minimumDarkPoolSize.call()).toNumber(),10)
  // });

  // it("anyone other than the owner cannot update the DarkNodeRegistry address", async () => {
  //   await gateway.updateDarkNodeRegistry("", {from: accounts[1]}).should.be.rejectedWith();
  // });

  // it("anyone other than the owner cannot update the TraderRegistry address", async () => {
  //   await gateway.updateTraderRegistry("", {from: accounts[1]}).should.be.rejectedWith();
  // });

  // it("anyone other than the owner cannot update the MinimumDarkPoolSize", async () => {
  //   await gateway.updateMinimumDarkPoolSize(10, {from: accounts[1]}).should.be.rejectedWith();
  // });

});