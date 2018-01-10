
const utils = require("../test_utils");
const { accounts, indexMap } = require("../accounts");
var config = require("../../republic-config");

var commonSteps = require('./common').commonSteps;
var minerRegistrarSteps = require('./minerRegistrar').minerRegistrarSteps;
var traderRegistrarSteps = require('./traderRegistrar').traderRegistrarSteps;
var orderBookSteps = require('./orderBook').orderBookSteps;

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

module.exports = {
  steps
}