import { BigNumber } from "bignumber.js";

/** USD/ETH ESTIMATE (for logging only) */
// Grab from https://api.coinmarketcap.com/v1/ticker/ethereum/
const ethPriceEstimate = 1170.11; // (as of 09/01/2018)

export const transactionFee = async (tx: any): Promise<BigNumber> => {
  const gasUsed = tx.receipt.gasUsed;
  let gasPrice = (await web3.eth.getTransaction(tx.tx)).gasPrice;
  gasPrice = gasPrice.minus(gasPrice).add(20000000000); // 20 gwei
  const fee = gasPrice.times(gasUsed);
  return fee;
};

let logs: any = {};
// logTx logs the gas price of a series of contract calls, returning the tx object the last one
export const logTx = async (description: any, ...promises: Array<Promise<any>>) => {
  let fee = 0;
  let gas = 0;
  let latestTx;
  for (var i = 0; i < promises.length; i++) {
    const promise = promises[i];
    latestTx = await promise;
    fee += parseFloat(web3.fromWei(await transactionFee(latestTx), "ether") as any); // TODO: Check this!
    gas += latestTx.receipt.gasUsed;
  }
  // Not very nice code:
  if (!logs[description]) {
    logs[description] = [];
  }
  logs[description].push(fee);
  // logs.add(JSON.stringify({ description: description, gas: gas, fee: fee }));
  return latestTx;
};

export const printCosts = () => {
  // Colours
  const green = "\x1b[32m";
  const red = "\x1b[31m";
  const reset = "\x1b[0m";

  console.log("\nCost estimates:");
  for (let i = 0; i < logs.length; i++) {
    const description = logs[i];
    const min = Math.min(...logs[description]);
    const max = Math.max(...logs[description]);
    const min_usd = Number(min * ethPriceEstimate).toFixed(2);
    const max_usd = Number(max * ethPriceEstimate).toFixed(2);
    console.log(`${description} used between ${green}${min_usd} USD${reset} and ${red}${max_usd} USD${reset}`);
  }
  logs = {};
};

export function assertEventsEqual(event: any, expected: any) {
  for (var key in expected) {
    // check if the property/key is defined in the object itself, not in parent
    if (expected.hasOwnProperty(key)) {
      if (key === "event") {
        (event.event).should.equal(expected.event);
      } else {
        const real = event.args[key];
        assert(key in event.args, `Expected event to contain parameter '${key}'`);
        if (typeof real === "object") {
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

export const seconds = 1;
export const minutes = seconds * 60; // 60
export const hours = minutes * 60; // 3600
export const days = hours * 24; // 86400

// https://github.com/ethereum/solidity/blob/060b2c2b23da99836eb54dc30eb7d870016bcb7a/libsolidity/ast/Types.cpp#L730

export const sleep = (s: number) => new Promise(resolve => setTimeout(resolve, s * 1000));

export const range = (n: number) => Array.from(Array(n).keys());

export const randomHash = () => web3.sha3((Math.random() * Number.MAX_SAFE_INTEGER).toString());

export const randomBytes = () => web3.sha3((Math.random() * Number.MAX_SAFE_INTEGER).toString());
