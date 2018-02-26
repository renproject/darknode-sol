
import * as chai from "chai";
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

import * as u from "./_helpers/test_utils";

// Initialise:
// tslint:disable-next-line:no-any
let utils: any;
(async () => {
  utils = await artifacts.require("Utils").deployed();
})();

contract("Utils", function () {
  //
});