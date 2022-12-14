const BN = require("bn.js");

const config = {
    MINIMUM_BOND: new BN(100000).mul(new BN(10).pow(new BN(18))),
    MINIMUM_POD_SIZE: 3, // 24 in production
    MINIMUM_EPOCH_INTERVAL_SECONDS: 30, // 216000 in production, 1 month
    DARKNODE_PAYOUT_PERCENT: 50, // Only payout 50% of the reward pool
    BLACKLIST_SLASH_PERCENT: 0, // Don't slash bond for blacklisting
    MALICIOUS_SLASH_PERCENT: 50, // Slash 50% of the bond
    SECRET_REVEAL_SLASH_PERCENT: 100, // Slash 100% of the bond
};

module.exports = {
    mainnet: {
        RenProxyAdmin: "0xDf1D8eD27C54bBE5833320cf5a19fd9E73530145",
        RenToken: "0x408e41876cCCDC0F92210600ef50372656052a38",
        DarknodeSlasher: "0x64512ff05a27756694E306e483cBB725F1754C0e",

        // Protocol
        ProtocolLogicV1: "0x8b49f212F2236F4f49bBeff878a73051a8915DE0",
        ProtocolProxy: "0xc25167fFa19B4d9d03c7d5aa4682c7063F345b66",

        // DNR
        DarknodeRegistryStore: "0x60Ab11FE605D2A2C3cf351824816772a131f8782",
        DarknodeRegistryLogicV1: "0x33b53A700de61b6be01d65A758b3635584bCF140",
        DarknodeRegistryProxy: "0x2D7b6C95aFeFFa50C068D50f89C5C0014e054f0A",
        DarknodeRegistryLogicV2: "",
        DarknodeRegistryV1ToV2Upgrader: "",

        // DNP
        DarknodePaymentStore: "0xE33417797d6b8Aec9171d0d6516E88002fbe23E7",
        DarknodePayment: "0x098e1708b920EFBdD7afe33Adb6a4CBa30c370B9",

        config: {
            ...config,
        },
    },
    testnet: {
        RenProxyAdmin: "0xf02e28A47300767cf14c5c15FeeC1053E271e020",
        RenToken: "0x9B5e38f20F90ED9CeA25f0a6b16E3e08DeBA9019",
        DarknodeSlasher: "",

        // Protocol
        ProtocolLogicV1: "",
        ProtocolProxy: "",

        // DNR
        DarknodeRegistryStore: "0xC2c126e1EB32E6Ad50c611fB92D009B4b4518B00",
        DarknodeRegistryLogicV1: "",
        DarknodeRegistryLogicV2: "0xaf75aa160bD5e578303c57c3896Eb15E400Fbc1F",
        DarknodeRegistryProxy: "0xC791dB283bc6FFbcC00e474B9F7eb130e48E8bC4",
        DarknodeRegistryV1ToV2Upgrader: "0x2bB01259DF399b19036329BFd45587878146BB80",

        // DNP
        DarknodePaymentStore: "",
        DarknodePayment: "",

        config: {
            ...config,
        },
    },

    config,
};
