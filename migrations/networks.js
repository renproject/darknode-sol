const BN = require("bn.js");

const config = {
    VERSION: "1.0.0",
    MINIMUM_BOND: new BN(100000).mul(new BN(10).pow(new BN(18))),
    MINIMUM_POD_SIZE: 3, // 24 in production
    MINIMUM_EPOCH_INTERVAL: 2, // 14400 in production
    DARKNODE_PAYMENT_CYCLE_DURATION_SECONDS: 300, // 300 for testnet (5 minutes in seconds), 86400 in mainnet testing (1 day), 2628000 in production (1 month in seconds)
    owner: "0xe02cabac3a62655335b1227dfdecfff27b5f6111", // Darknode public key
    shifterFees: 0,
    renExFees: 0,
}

module.exports = {
    mainnet: {
        RenToken: "0x408e41876cCCDC0F92210600ef50372656052a38",
        DarknodeSlasher: "0x0000000000000000000000000000000000000000",
        DarknodeRegistry: "0x34bd421C7948Bc16f826Fd99f9B785929b121633",
        DarknodeRegistryStore: "0x06df0657ba5e8f5339e742212669f6e7ee3c5057",
        DarknodePaymentStore: "0x731Ea4Ba77fF184d89dBeB160A0078274Acbe9D2",
        DarknodePayment: "0x5a7802E66b067cB1770ee5b1165AA201690A8B6a",
        tokens: {
            DAI: "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        BTCShifter: "",
        ZECShifter: "",
        zZEC: "",
        zBTC: "",

        config: {
            ...config,
            owner: "TODO",
        },
    },
    testnet: {
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: "0x0000000000000000000000000000000000000000",
        DarknodeRegistry: "0x1C6309618338D0EDf9a7Ea8eA18E060fD323020D",
        DarknodeRegistryStore: "0x88e4477e4fdd677aee2dc9376471d45c198669fa",
        DarknodePaymentStore: "0xA9411C3AD1fBE168fd119A3B32fB481a0b9877A9",
        DarknodePayment: "0x8E11B87547f4072CC8A094F2888201CAF4EA0B9e",
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        BTCShifter: "",
        ZECShifter: "",
        zZEC: "",
        zBTC: "",

        config: {
            ...config,
            owner: "0xe02cabac3a62655335b1227dfdecfff27b5f6111",
        },
    },

    devnet: {
        RenToken: '0x2cd647668494c1b15743ab283a0f980d90a87394',
        DarknodeSlasher: '0xCEC09904D3471B837E81DaC03E66Dd90888FD9c3',
        DarknodeRegistry: '0xb820735fd5d3a772eDC31e1f90E369eC25839AEb',
        DarknodeRegistryStore: '0x6357b8f3eFADCd3Dc1cC767999BDfD147AAd6A9D',
        DarknodePaymentStore: '0x5bF40Ca61310B43F360Ce0cf1F787151eBFDb50f',
        DarknodePayment: '0x800D25a54f0c8325eAA411584EE7B577070D2e29',
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        BTCShifter: '0x69c29D3Dd348B678D6ed739CD61d3bD8BB587890',
        ZECShifter: '0x5574Cb447afaFB92dadf801d6F46b4E6FE4043A1',
        zBTC: '0x9b2B31FBC4D48727460b2966092d6B55cA7C4Be3',
        zZEC: '0xF575cD19d62Fe2f49ffCD3eCE36E4b46D9F38d52',

        config: {
            ...config,
            owner: "0x26507602c1d904a2d330819bfb624014067a179a",
        },
    },
    config,
}