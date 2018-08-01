const DarknodeRegistry = artifacts.require("DarknodeRegistry");
const Orderbook = artifacts.require("Orderbook");
const DarknodeSlasher = artifacts.require("DarknodeSlasher");
const DarknodeRegistryStore = artifacts.require("DarknodeRegistryStore");
const RepublicToken = artifacts.require("RepublicToken");


import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
chai.should();

const MINIMUM_BOND = 100;
const MINIMUM_POD_SIZE = 72;
const MINIMUM_EPOCH_INTERVAL = 2;

const FEE = 1;

// Makes an ID for a darknode
function ID(i: string) {
    return web3.utils.sha3(i).slice(0, 42);
  }
  
// Makes a public key for a darknode
function PUBK(i: string) {
return web3.utils.sha3(i);
}

contract("DarknodeSlasher", function (accounts: string[]) {

  let dnrs, dnr, ren, orderbook, slasher;

  before(async function () {
    ren = await RepublicToken.new();
    dnrs = await DarknodeRegistryStore.new(ren.address);
    dnr = await DarknodeRegistry.new(
      ren.address,
      dnrs.address,
      MINIMUM_BOND,
      MINIMUM_POD_SIZE,
      MINIMUM_EPOCH_INTERVAL,
      accounts[3]
    );
    dnrs.transferOwnership(dnr.address);
    for (let i = 1; i < accounts.length; i++) {
      await ren.transfer(accounts[i], MINIMUM_BOND);
    }
    orderbook = await Orderbook.new(FEE, ren.address, dnr.address);
    slasher = await DarknodeSlasher.new(dnr.address, orderbook.address);

    await ren.transfer(accounts[1], MINIMUM_BOND);
    await ren.transfer(accounts[2], MINIMUM_BOND);

    await ren.approve(dnr.address, accounts[1]);
    await ren.approve(dnr.address, accounts[2]);

    dnr.register(ID("1"), PUBK("1"), {from:accounts[1]});
    dnr.register(ID("2"), PUBK("2"), {from:accounts[2]});

  });

//   it("", async() => {

//   })

  it("darknode can submit challenge order", async() => {
      
  })

  it("anyone other than registered darknodes cannot submit challenge order", async() => {
      
  })

  it("anyone can call submit challenge", async() => {

  })


});


