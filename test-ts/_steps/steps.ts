
import * as utils from "../_helpers/test_utils";
import { accounts, indexMap } from "../_helpers/accounts";
var config = require("../../republic-config");

/**
 * This pattern is used so that steps can be split into different files while still
 * being able to call all other steps
 */

// tslint:disable-next-line:no-any
const steps: any = {};
export default steps;

Object.assign(steps, require("./common"));
Object.assign(steps, require("./minerRegistrar"));
Object.assign(steps, require("./traderRegistrar"));
Object.assign(steps, require("./orderBook"));