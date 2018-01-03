
const transactionFee = async (tx) => {
  const gasUsed = tx.receipt.gasUsed;
  let gasPrice = (await web3.eth.getTransaction(tx.tx)).gasPrice;
  gasPrice = gasPrice.minus(gasPrice).add(20000000000); // 20 gwei
  const fee = gasPrice.times(gasUsed);
  return fee;
}


const logs = new Set();
// logTx logs the gas price of a series of contract calls, returning the tx object the last one
const logTx = async (description, ...promises) => {
  let fee = 0;
  let gas = 0;
  let latestTx;
  for (var i = 0; i < promises.length; i++) {
    const promise = promises[i];
    latestTx = await promise;
    fee += parseFloat(web3.fromWei(await transactionFee(latestTx), 'ether'));
    gas += latestTx.receipt.gasUsed;
  }
  // Not very nice code:
  logs.add(JSON.stringify({ description: description, gas: gas, fee: fee }));
  return latestTx;
}

const ethPriceEstimate = 806.13 // (as of 15/12/2017)

const printCosts = () => {
  // Colours
  const green = "\x1b[32m";
  const blue = "\x1b[34m";
  const cyan = "\x1b[36m";
  const reset = "\x1b[0m";

  for (var log of logs) {
    let { description, fee, gas } = JSON.parse(log);
    const usd = Number(fee * ethPriceEstimate).toFixed(2);
    fee = Number(fee).toFixed(6);
    console.log(`${description} used ${green}${gas} gas${reset} / ${blue}${fee} ETH${reset} / ${cyan}${usd} USD${reset}`);
  }
}

function assertEventsEqual(event, expected) {
  for (var key in expected) {
    // check if the property/key is defined in the object itself, not in parent
    if (expected.hasOwnProperty(key)) {
      if (key == "event") {
        (event.event).should.equal(expected.event);
      } else {
        const real = event.args[key];
        assert(key in event.args, `Expected event to contain parameter '${key}'`);
        if (typeof real === 'object') {
          // BigNumber.js
          (event.args[key]).should.be.bignumber.equal(expected[key]);
        } else {
          (event.args[key]).should.equal(expected[key]);
        }
      }
    }
  }
  return true;
}

// https://github.com/ethereum/solidity/blob/060b2c2b23da99836eb54dc30eb7d870016bcb7a/libsolidity/ast/Types.cpp#L730
const seconds = 1;
const minutes = seconds * 60; // 60
const hours = minutes * 60; // 3600
const days = hours * 24; // 86400

function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}


/*** Accounts ***/


module.exports = {
  transactionFee: transactionFee,
  logTx: logTx,
  printCosts: printCosts,
  assertEventsEqual: assertEventsEqual,
  days: days,
  hours: hours,
  minutes: minutes,
  seconds: seconds,
  sleep: sleep,
}
