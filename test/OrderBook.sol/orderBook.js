const chai = require("chai");
chai.use(require('chai-as-promised'));
chai.use(require('chai-bignumber')());
chai.should();

const utils = require("../test_utils");
const { accounts } = require("../accounts");
const steps = require("../_steps/steps");


const traderA = accounts[0];
const traderB = accounts[1];
const miners = accounts.slice(0, 10);
let mNetworks;

contract('Order Book', function () {

  beforeAll("register traders and miners", async () => {
    // Register traders:
    await steps.RegisterTrader(traderA);
    await steps.RegisterTrader(traderB);

    // Register miners:
    await Promise.all(miners.map(
      miner => steps.RegisterMiner(miner)
    ));

    // Get M Networks:
    const mNetworks = await steps.GetMNetworks();
  })

  it("can process an order submission", async () => {
    // 	function submitOrder(bytes32 _orderID, bytes32[] _orderFragmentIDs, bytes20[] _miners, bytes20[] _minerLeaders) public {

  });


  // // Log costs
  // after("log costs", () => {
  //   utils.printCosts();
  // });

});