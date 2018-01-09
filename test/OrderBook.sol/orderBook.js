const chai = require("chai");
chai.use(require('chai-as-promised'));
chai.use(require('chai-bignumber')());
chai.should();

const utils = require("../test_utils");
const { accounts } = require("../accounts");
const steps = require("../_steps/steps");



contract('Order Book', function () {

  it("can manage an order", async function () {

  });


  // // Log costs
  // after("log costs", () => {
  //   utils.printCosts();
  // });

});