
const utils = require("../test_utils");
const { accounts, indexMap } = require("../accounts");
var config = require("../../republic-config");

/**
 * This pattern is used so that steps can be split into different files while still
 * being able to call all other steps
 */

const steps = {};
module.exports.steps = steps;

Object.assign(steps, require('./common'));
Object.assign(steps, require('./minerRegistrar'));
Object.assign(steps, require('./traderRegistrar'));
Object.assign(steps, require('./orderBook'));