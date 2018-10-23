const BigNumber = require("bignumber.js");

module.exports = {
    VERSION: "1.0.0",
    MINIMUM_BOND: new BigNumber(100000).times(new BigNumber(10).exponentiatedBy(18)).toFixed(),
    MINIMUM_POD_SIZE: 3, // 24 in production
    MINIMUM_EPOCH_INTERVAL: 2, // 14400 in production
    CONTRACT_OWNER: "0x0000000000000000000000000000000000000000",
}