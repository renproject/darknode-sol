const BN = require("bn.js");

const config = {
    MINIMUM_BOND: new BN(100000).mul(new BN(10).pow(new BN(18))),
    MINIMUM_POD_SIZE: 3, // 24 in production
    MINIMUM_EPOCH_INTERVAL: 2, // 14400 in production
    DARKNODE_PAYMENT_CYCLE_DURATION_SECONDS: 300, // 300 for testnet (5 minutes in seconds), 86400 in mainnet testing (1 day), 2628000 in production (1 month in seconds)
    mintAuthority: "", // Darknode public key
    shifterFees: 10,
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
        ShifterRegistry: "",
        zZEC: "",
        zBTC: "",

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
        DarknodePaymentStore: "0xA9411C3AD1fBE168fd119A3B32fB481a0b9877A9",
        DarknodePayment: "0x8E11B87547f4072CC8A094F2888201CAF4EA0B9e",
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        BTCShifter: "0x8a0E8dfC2389726DF1c0bAB874dd2C9A6031b28f",
        ZECShifter: "0xEeC88ec22E6582409631530F44E48057E7Ed9bBa",
        zBTC: "0x1aFf7F90Bab456637a17d666D647Ea441A189F2d",
        zZEC: "0x51f41985134842Aa009CACdD28B2C69fA97C4738",
        ShifterRegistry: "0x40C605FF27411d3a2ea5A114D365a314cb7AC5f2",

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
        DarknodePaymentStore: "0x6341DF1012E862f766Fcd72e0fCAAc5a3839CFef",
        DarknodePayment: "0x1f1b1d015Fc31d425C616cC35E39e31686DA69A8",
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        BTCShifter: "0x7a40fE9FB464510215C41Eae1216973514eeEBB1",
        ZECShifter: "0x5345425363A49904De0746E7c991B05380E42E27",
        zBTC: "0x4eB1403f565c3e3145Afc3634F16e2F092545C2a",
        zZEC: "0x92E9aC7c07bb40eD9DAF1DbD88E7Dd77f5754529",
        ShifterRegistry: "0x7E1E8698bDB429D63B492D7795af039926006386",

        config: {
            ...config,
            mintAuthority: "0x723eb4380E03dF6a6f98Cc1338b00cfBE5E45218",
        },
    },

    localnet: {
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: "",
        DarknodeRegistry: "",
        DarknodeRegistryStore: "",
        DarknodePaymentStore: "",
        DarknodePayment: "",
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        BTCShifter: "",
        ZECShifter: "",
        zBTC: "",
        zZEC: "",
        ShifterRegistry: "",

        config: {
            ...config,
            mintAuthority: "0x04084f1cACCB87Dcab9a29a084281294dA96Bf44",
        },
    },

    config,
}