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

const randomHash =
  () => web3.sha3((Math.random() * Number.MAX_SAFE_INTEGER).toString());

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
    const fragmentCount = (await steps.GetMNetworkSize()).toNumber();

    // Random values for testing
    const orderId = randomHash();
    const fragmentIds = (Array.from(Array(fragmentCount))).map(undef => randomHash());
    const randomMNetwork = mNetworks[1 + Math.floor(Math.random() * (mNetworks.length - 1))];
    const leaderNetwork = mNetworks[0];

    // await steps.SubmitOrder(orderId, fragmentIds, randomMNetwork, leaderNetwork);

  });


  // // Log costs
  // after("log costs", () => {
  //   utils.printCosts();
  // });

});