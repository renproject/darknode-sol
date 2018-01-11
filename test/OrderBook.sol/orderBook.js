const chai = require("chai");
chai.use(require('chai-as-promised'));
chai.use(require('chai-bignumber')());
chai.should();

const utils = require("../test_utils");
const { accounts } = require("../accounts");
const steps = require("../_steps/steps").steps;


const traderCount = 2;
const minerCount = accounts.length - traderCount;

const trader_A = accounts[0];
const trader_B = accounts[1];
const miners = accounts.slice(traderCount, traderCount + minerCount);
let mNetworks;

const randomHash =
  () => web3.sha3((Math.random() * Number.MAX_SAFE_INTEGER).toString());

const randomBytes =
  () => web3.sha3((Math.random() * Number.MAX_SAFE_INTEGER).toString());

contract('Order Book', function () {

  before("register traders and miners", async () => {

    // Register traders:
    await steps.RegisterTrader(trader_A, 1000);
    await steps.RegisterTrader(trader_B, 1000);

    // Register miners:
    await Promise.all(miners.map(
      (miner, i) => steps.RegisterMiner(miner, 1000)
    ));

    // Wait for Miner Registrar epoch
    await steps.WaitForEpoch();

    // Get M Networks:
    mNetworks = await steps.GetMNetworks();
  })






  it("can process an order submission", async () => {

    const fragmentCount = (await steps.GetMNetworkSize()).toNumber();

    console.log(`Sizes: ${mNetworks.map(m => m.length)}. k: ${(fragmentCount - 1) / 2 + 1}`);

    // Random values for testing
    const orderID_A = randomHash();
    const orderID_B = randomHash();
    const zkCommitments = (utils.range(fragmentCount)).map(i => randomHash());
    const fragmentIds_A = (utils.range(fragmentCount)).map(i => randomHash());
    const fragmentIds_B = (utils.range(fragmentCount)).map(i => randomHash());
    const fragments_AB = (utils.range(fragmentCount)).map(i => randomBytes());
    const randomMNetwork = mNetworks[1 + Math.floor(Math.random() * (mNetworks.length - 1))];
    const mNetworkSize = randomMNetwork.length;
    const leaderNetwork = mNetworks[0];

    await steps.OpenOrder(trader_A, orderID_A, fragmentIds_A, randomMNetwork, leaderNetwork);
    await steps.OpenOrder(trader_B, orderID_B, fragmentIds_B, randomMNetwork, leaderNetwork);


    // Check order_A's fragments
    await Promise.all(utils.range(mNetworkSize).map(
      i => steps.CheckOrderFragment(orderID_A, fragmentIds_A[i], randomMNetwork[i])
    ));

    // Check order_B's fragments
    await Promise.all(utils.range(mNetworkSize).map(
      i => steps.CheckOrderFragment(orderID_B, fragmentIds_B[i], randomMNetwork[i])
    ));

    // // Submit order fragments
    const kValue = (fragmentCount - 1) / 2 + 1;
    await Promise.all(utils.range(kValue).map(
      // (bytes _outputFragment, bytes32 _zkCommitment, bytes32 _orderID1, bytes32 _orderID2, bytes20 _minerID, bytes32 _orderFragmentID1, bytes32 _orderFragmentID2)
      i => steps.SubmitOutputFragment(fragments_AB[i], zkCommitments[i], orderID_A, orderID_B, randomMNetwork[i], fragmentIds_A[i], fragmentIds_B[i])
    ));

    (await steps.IsOrderClosed(orderID_A))
      .should.be.true;
    (await steps.IsOrderClosed(orderID_B))
      .should.be.true;

    // await Promise.all(utils.range(mNetworkSize).map(
    //   i => steps.WithdrawReward(randomMNetwork[i])
    // ));

    // TODO: check withdrawal is successfull

    // assert(false); // To see events


  });


  // // Log costs
  // after("log costs", () => {
  //   utils.printCosts();
  // });

});