
const utils = require("../test_utils");
const { accounts, indexMap } = require("../accounts");
var config = require("../../republic-config");

var commonSteps = require('./common');
var minerRegistrarSteps = require('./minerRegistrar');
var traderRegistrarSteps = require('./traderRegistrar');
var orderBookSteps = require('./orderBook');

// Initialise:
let ren, minerRegistrar;
(async () => {
  ren = await artifacts.require("RepublicToken").deployed();
  minerRegistrar = await artifacts.require("MinerRegistrar").deployed();
})();


const steps = {
  ...commonSteps,
  ...minerRegistrarSteps,
  ...traderRegistrarSteps,
  ...orderBookSteps,
}

module.exports = steps;