const BN = require("bn.js");

module.exports = {
    VERSION: "1.0.0",
    MINIMUM_BOND: new BN(100000).mul(new BN(10).pow(new BN(18))),
    MINIMUM_POD_SIZE: 3, // 24 in production
    MINIMUM_EPOCH_INTERVAL: 2, // 14400 in production
    DARKNODE_PAYMENT_CYCLE_DURATION_SECONDS: 86400, // (5 minutes in seconds), 86400 in mainnet testing (1 day), 2628000 in production (1 month in seconds)
}