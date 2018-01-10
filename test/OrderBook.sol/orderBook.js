const chai = require("chai");
chai.use(require('chai-as-promised'));
chai.use(require('chai-bignumber')());
chai.should();

const utils = require("../test_utils");
const { accounts } = require("../accounts");
const steps = require("../_steps/steps");


const traderCount = 2;
const minerCount = 10;

const traderA = accounts[0];
const traderB = accounts[1];
const miners = accounts.slice(traderCount, traderCount + minerCount);
let mNetworks;

contract('Order Book', function () {

  before("register traders and miners", async () => {
    // Register traders:
    await steps.RegisterTrader(traderA, 1000);
    await steps.RegisterTrader(traderB, 1000);

    // Register miners:
    await Promise.all(miners.map(
      miner => steps.RegisterMiner(miner, 1000)
    ));

    // Wait for Miner Registrar epoch
    await steps.WaitForEpoch();

    // Get M Networks:
    mNetworks = await steps.GetMNetworks();
  })

  it("can process an order submission", async () => {
    // 	function submitOrder(bytes32 _orderID, bytes32[] _orderFragmentIDs, bytes20[] _miners, bytes20[] _minerLeaders) public {
    // await steps.RegisterTrader(accounts[0]);
  });


  // // Log costs
  // after("log costs", () => {
  //   utils.printCosts();
  // });

});