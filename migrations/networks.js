const BN = require("bn.js");

const config = {
    MINIMUM_BOND: new BN(100000).mul(new BN(10).pow(new BN(18))),
    MINIMUM_POD_SIZE: 3, // 24 in production
    MINIMUM_EPOCH_INTERVAL: 2, // 14400 in production
    DARKNODE_PAYMENT_CYCLE_DURATION_SECONDS: 300, // 300 for testnet (5 minutes in seconds), 86400 in mainnet testing (1 day), 2628000 in production (1 month in seconds)
    mintAuthority: "", // Darknode public key
    shifterFees: 10,
    zBTCMinShiftOutAmount: 10000,
    zZECMinShiftOutAmount: 10000,
}

module.exports = {
    mainnet: {
        RenToken: "0x408e41876cCCDC0F92210600ef50372656052a38",
        DarknodeSlasher: "0x0000000000000000000000000000000000000000",
        DarknodeRegistry: "0x34bd421C7948Bc16f826Fd99f9B785929b121633",
        DarknodeRegistryStore: "0x06df0657ba5e8f5339e742212669f6e7ee3c5057",
        DarknodePayment: "0x5a7802E66b067cB1770ee5b1165AA201690A8B6a",
        DarknodePaymentStore: "0x731Ea4Ba77fF184d89dBeB160A0078274Acbe9D2",
        tokens: {
            DAI: "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        ShifterRegistry: "",
        zZEC: "",
        BTCShifter: "",
        zBTC: "",
        ZECShifter: "",

        config: {
            ...config,
            mintAuthority: "TODO",
        },
    },
    testnet: {
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: "0x0000000000000000000000000000000000000000",
        DarknodeRegistry: "0x1C6309618338D0EDf9a7Ea8eA18E060fD323020D",
        DarknodeRegistryStore: "0x88e4477e4fdd677aee2dc9376471d45c198669fa",
        DarknodePayment: "0x8E11B87547f4072CC8A094F2888201CAF4EA0B9e",
        DarknodePaymentStore: "0xA9411C3AD1fBE168fd119A3B32fB481a0b9877A9",
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        ShifterRegistry: "0x1a62cE8d00d061A05A70dB318f7dfE9Ecd9fFcB0",
        zBTC: "0x1aFf7F90Bab456637a17d666D647Ea441A189F2d",
        BTCShifter: "0x8a0E8dfC2389726DF1c0bAB874dd2C9A6031b28f",
        zZEC: "0x51f41985134842Aa009CACdD28B2C69fA97C4738",
        ZECShifter: "0xEeC88ec22E6582409631530F44E48057E7Ed9bBa",

        config: {
            ...config,
            mintAuthority: "0x44Bb4eF43408072bC888Afd1a5986ba0Ce35Cb54",
        },
    },

    devnet: {
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: "0xfe48363206E1849a2F53f5214af932354c35FD89",
        DarknodeRegistry: "0x6E1a6b85f05bfec5c24C7a26E302cB28e639651c",
        DarknodeRegistryStore: "0xC126a308dd07Adfa4a445686dcF7CbC423185593",
        DarknodePayment: "0x1f1b1d015Fc31d425C616cC35E39e31686DA69A8",
        DarknodePaymentStore: "0x6341DF1012E862f766Fcd72e0fCAAc5a3839CFef",
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        ShifterRegistry: "",
        zBTC: "",
        BTCShifter: "",
        zZEC: "",
        ZECShifter: "",

        config: {
            ...config,
            mintAuthority: "0x1B9d58208879AA9aa9E10040b34cF2b684237621",
        },
    },

    localnet: {
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: '0xa6B1d1E63B92F8Fb36F8E1356FD5739e6433f0a3',
        DarknodeRegistry: '0xA7F5B11657AA2796B9355DceF075202C26507B9B',
        DarknodeRegistryStore: '0x46d016F50837a5DF8fe229127e54fb18B621bAeF',
        DarknodePayment: '0x7c71E53853863ce0a3BE7D024EF99aba7d872bfe',
        DarknodePaymentStore: '0x72Acdf4f0E3245262E46Bd8daCc207Df7CF3A534',
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        ShifterRegistry: "0x33666067A7741B9e88520285C96B776E73281811",
        zBTC: "0xDE027035d33CEB2757685E325de1A0b924aA73E6",
        BTCShifter: "0x7012ECc13De5Ce416C14C013d9b02b7c37154b37",
        zZEC: "0xB7b7be50B13E6817afBb30C93161D0eB388b8f08",
        ZECShifter: "0x69AC72Cb35B1AA818e90842C048719a3246ba0BE",

        config: {
            ...config,
            mintAuthority: "0x04084f1cACCB87Dcab9a29a084281294dA96Bf44",
        },
    },

    config,
}